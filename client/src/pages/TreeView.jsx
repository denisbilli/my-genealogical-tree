import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Tree from 'react-d3-tree';
import { authService, personService } from '../services/api';
import PersonModal from '../components/PersonModal';

function TreeView() {
  const [persons, setPersons] = useState([]);
  const [treeData, setTreeData] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  useEffect(() => {
    loadPersons();
  }, []);

  useEffect(() => {
    if (persons.length > 0) {
      buildTreeData();
    }
  }, [persons]);

  const loadPersons = async () => {
    try {
      const response = await personService.getAll();
      setPersons(response.data);
    } catch (error) {
      console.error('Error loading persons:', error);
    }
  };

  const buildTreeData = () => {
    // Find root persons (those without parents)
    const roots = persons.filter(p => !p.parents || p.parents.length === 0);
    
    if (roots.length === 0) {
      // If no root, just pick the first person
      if (persons.length > 0) {
        setTreeData(buildNode(persons[0]));
      }
      return;
    }

    // Build tree from first root
    setTreeData(buildNode(roots[0]));
  };

  const buildNode = (person) => {
    if (!person) return null;

    const node = {
      name: `${person.firstName} ${person.lastName}`,
      attributes: {
        Gender: person.gender,
        Born: person.birthDate ? new Date(person.birthDate).getFullYear() : 'Unknown',
        Died: person.deathDate ? new Date(person.deathDate).getFullYear() : 'Living'
      },
      nodeSvgShape: {
        shape: 'circle',
        shapeProps: {
          r: 10,
          fill: person.gender === 'male' ? '#6495ED' : '#FFB6C1'
        }
      },
      _id: person._id,
      _person: person,
      children: []
    };

    // Add children
    if (person.children && person.children.length > 0) {
      person.children.forEach(childId => {
        const child = persons.find(p => p._id === childId || p._id === childId._id);
        if (child) {
          const childNode = buildNode(child);
          if (childNode) {
            node.children.push(childNode);
          }
        }
      });
    }

    return node;
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const handleNodeClick = (nodeData) => {
    if (nodeData.data._person) {
      setSelectedPerson(nodeData.data._person);
      setShowModal(true);
    }
  };

  const handleSavePerson = async (personData) => {
    try {
      if (selectedPerson) {
        await personService.update(selectedPerson._id, personData);
      } else {
        await personService.create(personData);
      }
      setShowModal(false);
      loadPersons();
    } catch (error) {
      console.error('Error saving person:', error);
      throw error;
    }
  };

  const renderCustomNode = ({ nodeDatum }) => (
    <g>
      <circle r="30" fill={nodeDatum.nodeSvgShape?.shapeProps?.fill || '#ccc'} />
      <text 
        fill="black" 
        strokeWidth="0" 
        x="40" 
        y="5"
        style={{ 
          fontSize: '14px', 
          fontWeight: 'bold'
        }}
      >
        {nodeDatum.name}
      </text>
      {nodeDatum.attributes && (
        <>
          <text fill="gray" strokeWidth="0" x="40" y="20" style={{ fontSize: '12px' }}>
            {nodeDatum.attributes.Gender} • {nodeDatum.attributes.Born}
            {nodeDatum.attributes.Died !== 'Living' && ` - ${nodeDatum.attributes.Died}`}
          </text>
        </>
      )}
    </g>
  );

  return (
    <div>
      <nav className="navbar">
        <h1>My Genealogical Tree</h1>
        <div className="navbar-links">
          <span>Welcome, {user?.fullName}</span>
          <Link to="/tree">View Tree</Link>
          <Link to="/dashboard">Dashboard</Link>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div className="tree-container">
        {treeData ? (
          <Tree
            data={treeData}
            orientation="vertical"
            translate={{ x: 400, y: 50 }}
            pathFunc="step"
            separation={{ siblings: 2, nonSiblings: 2 }}
            nodeSize={{ x: 300, y: 150 }}
            renderCustomNodeElement={renderCustomNode}
            onNodeClick={handleNodeClick}
            zoom={0.8}
          />
        ) : (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            flexDirection: 'column'
          }}>
            <h2>No family tree data available</h2>
            <p>Go to the dashboard to add family members</p>
            <Link to="/dashboard">
              <button className="btn" style={{ marginTop: '20px' }}>
                Go to Dashboard
              </button>
            </Link>
          </div>
        )}
      </div>

      {showModal && (
        <PersonModal
          person={selectedPerson}
          persons={persons}
          onSave={handleSavePerson}
          onClose={() => {
            setShowModal(false);
            setSelectedPerson(null);
          }}
        />
      )}
    </div>
  );
}

export default TreeView;
