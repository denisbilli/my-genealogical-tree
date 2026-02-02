import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService, personService } from '../services/api';
import PersonModal from '../components/PersonModal';

function Dashboard() {
  const [persons, setPersons] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [matches, setMatches] = useState([]);
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  useEffect(() => {
    loadPersons();
    loadMatches();
  }, []);

  const loadPersons = async () => {
    try {
      const response = await personService.getAll();
      setPersons(response.data);
    } catch (error) {
      console.error('Error loading persons:', error);
    }
  };

  const loadMatches = async () => {
    try {
      const response = await personService.searchMatches();
      setMatches(response.data);
    } catch (error) {
      console.error('Error loading matches:', error);
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const handleAddPerson = () => {
    setEditingPerson(null);
    setShowModal(true);
  };

  const handleEditPerson = (person) => {
    setEditingPerson(person);
    setShowModal(true);
  };

  const handleDeletePerson = async (id) => {
    if (window.confirm('Are you sure you want to delete this person?')) {
      try {
        await personService.delete(id);
        loadPersons();
      } catch (error) {
        console.error('Error deleting person:', error);
        alert('Failed to delete person');
      }
    }
  };

  const handleSavePerson = async (personData) => {
    try {
      if (editingPerson) {
        await personService.update(editingPerson._id, personData);
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

      <div className="dashboard">
        <div className="dashboard-header">
          <h2>Family Members</h2>
          <button className="btn" onClick={handleAddPerson}>
            Add New Person
          </button>
        </div>

        {matches.length > 0 && (
          <div style={{ 
            background: '#fff3cd', 
            padding: '15px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '1px solid #ffc107'
          }}>
            <h3 style={{ color: '#856404', marginBottom: '10px' }}>
              🎯 Potential Matches Found!
            </h3>
            <p style={{ color: '#856404' }}>
              We found {matches.length} potential match(es) between your tree and other users. 
              These connections could help expand your family tree!
            </p>
          </div>
        )}

        <div className="person-list">
          {persons.map(person => (
            <div key={person._id} className="person-card">
              {person.photoUrl && (
                <img 
                  src={person.photoUrl} 
                  alt={`${person.firstName} ${person.lastName}`}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <h3>{person.firstName} {person.lastName}</h3>
              <p><strong>Gender:</strong> {person.gender}</p>
              {person.birthDate && (
                <p><strong>Born:</strong> {new Date(person.birthDate).toLocaleDateString()}</p>
              )}
              {person.birthPlace && (
                <p><strong>Birth Place:</strong> {person.birthPlace}</p>
              )}
              {person.deathDate && (
                <p><strong>Died:</strong> {new Date(person.deathDate).toLocaleDateString()}</p>
              )}
              {person.notes && (
                <p><strong>Notes:</strong> {person.notes}</p>
              )}
              <div className="person-card-actions">
                <button 
                  className="btn-edit" 
                  onClick={() => handleEditPerson(person)}
                >
                  Edit
                </button>
                <button 
                  className="btn-delete" 
                  onClick={() => handleDeletePerson(person._id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {persons.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            background: 'white', 
            borderRadius: '10px' 
          }}>
            <h3>No family members yet</h3>
            <p>Start building your family tree by adding your first person!</p>
          </div>
        )}
      </div>

      {showModal && (
        <PersonModal
          person={editingPerson}
          persons={persons}
          onSave={handleSavePerson}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

export default Dashboard;
