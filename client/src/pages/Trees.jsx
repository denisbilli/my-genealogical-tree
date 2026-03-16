import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, GitBranch, CheckCircle, XCircle, Star } from 'lucide-react';
import { familyTreeService } from '../services/api';
import Layout from '../components/Layout';

function Trees() {
  const [trees, setTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTree, setEditingTree] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const navigate = useNavigate();

  useEffect(() => {
    loadTrees();
  }, []);

  const loadTrees = async () => {
    try {
      const res = await familyTreeService.getAll();
      setTrees(res.data);
    } catch (err) {
      setError('Failed to load family trees');
    } finally {
      setLoading(false);
    }
  };

  const showMsg = (msg) => { setMessage(msg); setError(''); setTimeout(() => setMessage(''), 4000); };
  const showErr = (msg) => { setError(msg); setMessage(''); setTimeout(() => setError(''), 4000); };

  const handleOpenForm = (tree = null) => {
    setEditingTree(tree);
    setFormData(tree ? { name: tree.name, description: tree.description || '' } : { name: '', description: '' });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTree) {
        await familyTreeService.update(editingTree._id, formData);
        showMsg('Tree updated successfully');
      } else {
        await familyTreeService.create(formData);
        showMsg('Tree created successfully');
      }
      setShowForm(false);
      loadTrees();
    } catch (err) {
      showErr(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (tree) => {
    if (!window.confirm(`Delete tree "${tree.name}" and all its persons? This cannot be undone.`)) return;
    try {
      await familyTreeService.delete(tree._id);
      showMsg('Tree deleted');
      loadTrees();
    } catch (err) {
      showErr(err.response?.data?.message || 'Failed to delete tree');
    }
  };

  const handleSetDefault = async (tree) => {
    try {
      await familyTreeService.update(tree._id, { isDefault: true });
      showMsg(`"${tree.name}" is now the default tree`);
      loadTrees();
    } catch (err) {
      showErr('Failed to set default tree');
    }
  };

  const handleViewTree = (tree) => {
    // Store selected tree in localStorage so Dashboard and TreeView can filter
    localStorage.setItem('selectedTreeId', tree._id);
    localStorage.setItem('selectedTreeName', tree.name);
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <Layout title="Heritg.org">
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-main)' }}>Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout title="Heritg.org" showBackButton={true} backButtonText="Dashboard" backButtonPath="/dashboard">
      <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ color: 'var(--text-main)', fontSize: '1.75rem', fontWeight: 700 }}>
            Family Trees
          </h1>
          <button className="btn btn-primary" onClick={() => handleOpenForm()}>
            <Plus size={16} /> New Tree
          </button>
        </div>

        {message && (
          <div style={{ background: '#d4edda', border: '1px solid #c3e6cb', color: '#155724', padding: '12px 16px', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={16} /> {message}
          </div>
        )}
        {error && (
          <div style={{ background: '#f8d7da', border: '1px solid #f5c6cb', color: '#721c24', padding: '12px 16px', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <XCircle size={16} /> {error}
          </div>
        )}

        {/* Create/Edit Form */}
        {showForm && (
          <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid var(--primary)' }}>
            <h2 style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>
              {editingTree ? 'Edit Tree' : 'Create New Tree'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label style={{ color: 'var(--text-secondary)' }}>Tree Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g. Rossi Family Tree"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
                />
              </div>
              <div className="form-group">
                <label style={{ color: 'var(--text-secondary)' }}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description..."
                  rows="3"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">{editingTree ? 'Save Changes' : 'Create Tree'}</button>
                <button type="button" className="btn" onClick={() => setShowForm(false)} style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)' }}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Trees list */}
        {trees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', background: 'var(--card-bg)', borderRadius: '12px', color: 'var(--text-main)' }}>
            <GitBranch size={48} color="var(--text-secondary)" style={{ marginBottom: '1rem' }} />
            <h3>No family trees yet</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Create your first family tree to start adding members!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {trees.map((tree) => (
              <div
                key={tree._id}
                style={{
                  background: 'var(--card-bg)',
                  borderRadius: '12px',
                  padding: '1.25rem 1.5rem',
                  border: tree.isDefault ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <GitBranch size={18} color="var(--primary)" />
                    <h3 style={{ color: 'var(--text-main)', margin: 0, fontWeight: 600 }}>{tree.name}</h3>
                    {tree.isDefault && (
                      <span style={{ background: 'var(--primary)', color: 'white', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                        Default
                      </span>
                    )}
                  </div>
                  {tree.description && (
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>{tree.description}</p>
                  )}
                  <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: '0.8rem' }}>
                    {tree.personCount} {tree.personCount === 1 ? 'person' : 'people'} · Created {new Date(tree.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleViewTree(tree)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    Open
                  </button>
                  {!tree.isDefault && (
                    <button
                      className="btn"
                      onClick={() => handleSetDefault(tree)}
                      title="Set as default"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Star size={14} /> Set Default
                    </button>
                  )}
                  <button
                    className="btn"
                    onClick={() => handleOpenForm(tree)}
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  {trees.length > 1 && (
                    <button
                      className="btn"
                      onClick={() => handleDelete(tree)}
                      style={{ background: '#dc3545', color: 'white', fontSize: '0.85rem' }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Trees;
