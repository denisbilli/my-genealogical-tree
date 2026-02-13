import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { personService } from '../services/api';
import PersonModal from '../components/PersonModal';
import Layout from '../components/Layout';

function Dashboard() {
  const [persons, setPersons] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [matches, setMatches] = useState([]);
  const navigate = useNavigate();

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

  const handleResetDB = async () => {
    if (window.confirm('⚠️ WARNING: This will delete ALL persons and relationships.\nType "RESET" to confirm.')) {
        const confirm = window.prompt("Type 'RESET' to wipe the database:");
        if (confirm === 'RESET') {
            try {
                await personService.resetParams();
                alert('Database reset complete.');
                loadPersons();
            } catch (error) {
                console.error('Reset failed:', error);
                alert('Reset failed.');
            }
        }
    }
  };

  const handleRepairDB = async () => {
      try {
          const res = await personService.repairTree();
          alert(`Repair Complete: Merged ${res.data.fixedCouples} couples, removed ${res.data.removedUnions} duplicates.`);
      } catch (error) {
          alert('Repair failed.');
      }
  };

  return (
    <Layout title="Heritg.org" showBackButton={true} backButtonText="View Tree" backButtonPath="/tree">
      <div className="dashboard">
        <div className="dashboard-header">
          <h2 style={{ color: 'var(--text-main)' }}>Family Members</h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
                className="btn" 
                style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                onClick={handleRepairDB}
            >
                Repair Tree
            </button>
            <button 
                className="btn" 
                style={{ backgroundColor: '#dc3545', color: 'white' }}
                onClick={handleResetDB}
            >
                Reset Database
            </button>
            <button className="btn btn-primary" onClick={handleAddPerson}>
                <Plus size={16} /> Add New Person
            </button>
          </div>
        </div>

        {matches.length > 0 && (
          <div style={{ 
            background: 'var(--bg-secondary)', 
            padding: '15px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '1px solid var(--border-color)'
          }}>
            <h3 style={{ color: 'var(--primary)', marginBottom: '10px' }}>
              🎯 Potential Matches Found!
            </h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              We found {matches.length} potential match(es) between your tree and other users. 
              These connections could help expand your family tree!
            </p>
          </div>
        )}

        <div className="persons-grid">
          {persons.map(person => (
            <div key={person._id} className="person-card-dash">
              <div className="person-header">
                  <div className="person-avatar">
                      {person.photoUrl ? (
                         <img 
                           src={person.photoUrl} 
                           alt={`${person.firstName} ${person.lastName}`}
                           onError={(e) => { e.target.style.display = 'none'; }}
                         />
                      ) : (
                          <span>{person.firstName[0]}{person.lastName[0]}</span>
                      )}
                  </div>
                  <div className="person-info">
                      <h3 style={{ color: 'var(--text-main)' }}>{person.firstName} {person.lastName}</h3>
                      <p style={{ color: 'var(--text-secondary)' }}>{person.gender} • {person.birthDate ? new Date(person.birthDate).getFullYear() : '?'}</p>
                  </div>
              </div>
              
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  {person.birthPlace && (
                    <div style={{ marginBottom: '4px' }}>📍 {person.birthPlace}</div>
                  )}
                  {person.deathDate && (
                    <div style={{ marginBottom: '4px' }}>✝️ {new Date(person.deathDate).toLocaleDateString()}</div>
                  )}
              </div>

              <div className="person-actions">
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
            background: 'var(--card-bg)', 
            borderRadius: '10px',
            color: 'var(--text-main)'
          }}>
            <h3>No family members yet</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Start building your family tree by adding your first person!</p>
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
    </Layout>
  );
}

export default Dashboard;
