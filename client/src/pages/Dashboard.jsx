import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, GitBranch, UserCheck, UserX } from 'lucide-react';
import { personService, profileService } from '../services/api';
import PersonModal from '../components/PersonModal';
import Layout from '../components/Layout';

function Dashboard() {
  const [persons, setPersons] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [matches, setMatches] = useState([]);
  const [selectedTreeId, setSelectedTreeId] = useState(() => localStorage.getItem('selectedTreeId') || null);
  const [selectedTreeName, setSelectedTreeName] = useState(() => localStorage.getItem('selectedTreeName') || null);
  // Link-user modal
  const [linkUserPerson, setLinkUserPerson] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // Re-read tree selection whenever we navigate to this page
  useEffect(() => {
    const treeId = localStorage.getItem('selectedTreeId') || null;
    const treeName = localStorage.getItem('selectedTreeName') || null;
    setSelectedTreeId(treeId);
    setSelectedTreeName(treeName);
  }, [location]);

  useEffect(() => {
    loadPersons();
    loadMatches();
  }, [selectedTreeId]);

  const loadPersons = async () => {
    try {
      const response = await personService.getAll(selectedTreeId);
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

  // Open link-user modal for a person
  const handleOpenLinkUser = async (person) => {
    setLinkUserPerson(person);
    setSelectedUserId(person.linkedUserId || '');
    if (allUsers.length === 0) {
      try {
        const res = await profileService.listUsers();
        setAllUsers(res.data);
      } catch {
        alert('Could not load users list.');
        return;
      }
    }
  };

  const handleSaveLinkUser = async () => {
    try {
      await personService.linkUser(linkUserPerson._id, selectedUserId || null);
      setLinkUserPerson(null);
      loadPersons();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to link user.');
    }
  };

  return (
    <Layout title="Heritg.org" showBackButton={true} backButtonText="View Tree" backButtonPath="/tree">
      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h2 style={{ color: 'var(--text-main)' }}>Family Members</h2>
            {selectedTreeName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontSize: '0.85rem', marginTop: '2px' }}>
                <GitBranch size={14} />
                <span>Tree: <strong>{selectedTreeName}</strong></span>
                <button
                  onClick={() => { localStorage.removeItem('selectedTreeId'); localStorage.removeItem('selectedTreeName'); navigate('/trees'); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', padding: '0 4px' }}
                  title="Change tree"
                >
                  (change)
                </button>
              </div>
            )}
          </div>
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
              
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  {person.birthPlace && (
                    <div style={{ marginBottom: '4px' }}>📍 {person.birthPlace}</div>
                  )}
                  {person.deathDate && (
                    <div style={{ marginBottom: '4px' }}>✝️ {new Date(person.deathDate).toLocaleDateString()}</div>
                  )}
              </div>

              {/* Linked user badge */}
              {person.linkedUserId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                  <UserCheck size={13} />
                  <span>Linked to a user account</span>
                </div>
              )}

              <div className="person-actions" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
                <button 
                  className="btn-edit" 
                  onClick={() => handleEditPerson(person)}
                >
                  Edit
                </button>
                <button
                  className="btn-edit"
                  onClick={() => handleOpenLinkUser(person)}
                  title="Assign a user account to this person"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <UserCheck size={13} /> Link User
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

      {/* Link User Modal */}
      {linkUserPerson && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: 'var(--card-bg)', borderRadius: '12px', padding: '1.5rem',
            width: '100%', maxWidth: '420px', border: '1px solid var(--border-color)'
          }}>
            <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserCheck size={20} color="var(--primary)" />
              Link User to Person
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Assign a registered user account to <strong style={{ color: 'var(--text-main)' }}>{linkUserPerson.firstName} {linkUserPerson.lastName}</strong>.
            </p>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: '6px', marginBottom: '1rem',
                border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)'
              }}
            >
              <option value="">— No user (unlink) —</option>
              {allUsers.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.fullName} (@{u.username})
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setLinkUserPerson(null)}
                className="btn"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
              >
                Cancel
              </button>
              <button onClick={handleSaveLinkUser} className="btn btn-primary">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Dashboard;
