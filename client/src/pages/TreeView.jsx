import React, { useState, useEffect } from 'react';
import { User, Plus, Trash2, LogOut, RefreshCw, TreeDeciduous } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService, personService } from '../services/api';
import PersonModal from '../components/PersonModal';

function TreeView() {
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [pendingRelation, setPendingRelation] = useState(null); // { type: 'parent' | 'child' | 'edit', personId: string }
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  useEffect(() => {
    loadPersons();
  }, []);

  const loadPersons = async () => {
    setLoading(true);
    try {
      const response = await personService.getAll();
      setPersons(response.data);
    } catch (error) {
      console.error('Error loading persons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const initiateAddParent = (person) => {
    setPendingRelation({ type: 'parent', personId: person._id });
    setSelectedPerson(null);
    setShowModal(true);
  };

  const initiateAddChild = (person) => {
    setPendingRelation({ type: 'child', personId: person._id });
    setSelectedPerson(null);
    setShowModal(true);
  };

  const initiateEdit = (person) => {
    setPendingRelation({ type: 'edit', personId: person._id });
    setSelectedPerson(person);
    setShowModal(true);
  };

  const deletePerson = async (id) => {
    if (!window.confirm("Sei sicuro di voler eliminare questa persona?")) return;
    try {
        await personService.delete(id);
        loadPersons();
    } catch (error) {
        console.error(error);
        alert("Errore durante l'eliminazione");
    }
  };

  const handleSavePerson = async (formData) => {
    try {
      if (pendingRelation?.type === 'edit') {
        await personService.update(selectedPerson._id, formData);
      } else if (pendingRelation?.type === 'child') {
        const payload = { ...formData, parentIds: JSON.stringify([pendingRelation.personId]) };
        await personService.create(payload);
      } else if (pendingRelation?.type === 'parent') {
        const newParentRes = await personService.create(formData);
        const newParent = newParentRes.data;
        const child = persons.find(p => p._id === pendingRelation.personId);
        const currentParentIds = child.parents.map(p => typeof p === 'object' ? p._id : p);
        
        await personService.update(child._id, {
            parents: JSON.stringify([...currentParentIds, newParent._id]) 
        });
      } else {
        await personService.create(formData);
      }
      setShowModal(false);
      loadPersons();
    } catch (error) {
      console.error('Save failed:', error);
      alert('Errore nel salvataggio: ' + (error.response?.data?.message || error.message));
    }
  };

  const FamilyNode = ({ personId }) => {
    const person = persons.find(p => p._id === personId);
    if (!person) return null;

    const children = persons.filter(p => 
      p.parents && p.parents.some(parent => 
        (typeof parent === 'object' ? parent._id : parent) === personId
      )
    );

    return (
      <div className="tree-node">
        {/* Node Card */}
        <div className="node-card">
            {/* Add Parent Button */}
            <button 
                className="btn-add-parent"
                onClick={(e) => { e.stopPropagation(); initiateAddParent(person); }}
                title="Aggiungi Genitore"
            >
                <Plus size={14} />
            </button>

            <div className="flex items-center gap-3">
                <div className="node-image-wrapper">
                    {person.photoUrl ? (
                        <img src={person.photoUrl} alt={person.firstName} className="node-image" />
                    ) : (
                        <User size={24} />
                    )}
                </div>
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <h3 style={{ fontWeight: 'bold', margin: 0, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {person.firstName} <span style={{ textTransform: 'uppercase', fontSize: '0.8rem', opacity: 0.7 }}>{person.lastName}</span>
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#666' }}>
                        {person.birthDate ? new Date(person.birthDate).getFullYear() : '?'} - {person.deathDate ? new Date(person.deathDate).getFullYear() : 'Presente'}
                    </p>
                </div>
                <div className="flex flex-col gap-1">
                     <button onClick={() => initiateEdit(person)} className="text-gray-400 hover:text-blue-500" title="Modifica">
                        <User size={14} />
                    </button>
                    <button onClick={() => deletePerson(person._id)} className="text-gray-400 hover:text-red-500" title="Elimina">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Add Child Button */}
            <button 
                className="btn-add-child"
                onClick={(e) => { e.stopPropagation(); initiateAddChild(person); }}
                title="Aggiungi Figlio"
            >
                <Plus size={14} />
            </button>
        </div>

        {/* Children Recursion with Lines */}
        {children.length > 0 && (
            <div className="flex flex-col items-center">
                {/* Vertical line from parent down to children bus */}
                <div className="connector-line-vertical"></div>
                
                {/* Horizontal bus line */}
                <div className="connector-lines-horizontal">
                    {children.map(child => (
                        <div key={child._id} className="child-wrapper">
                            <FamilyNode personId={child._id} />
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
    );
  };

  const rootNodes = persons.filter(p => !p.parents || p.parents.length === 0);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column' }}>
      <header className="app-header sticky top-0 z-50">
        <div className="app-title">
          <TreeDeciduous size={24} color="var(--primary)" />
          <span>Heritg.org</span>
        </div>
        <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Ciao, {user?.fullName || 'Utente'}</span>
            <button onClick={handleLogout} className="btn btn-danger p-2 rounded-full" title="Logout">
                <LogOut size={20} />
            </button>
        </div>
      </header>
      
      <main className="tree-wrapper">
        {loading && persons.length === 0 ? (
           <div className="flex items-center justify-center w-full">Caricamento...</div>
        ) : (
           <div className="flex gap-16">
             {rootNodes.length === 0 && persons.length > 0 ? (
                 <div className="flex flex-col items-center mt-10">
                     <p className="text-red-500 mb-4">Attenzione: Nessun nodo radice trovato o struttura circolare.</p>
                     <div className="flex gap-4 flex-wrap justify-center">
                        {persons.map(p => (
                             <div key={p._id} className="node-card">
                                <strong>{p.firstName} {p.lastName}</strong>
                             </div>
                        ))}
                     </div>
                 </div>
             ) : rootNodes.length > 0 ? (
                 rootNodes.map(root => (
                     <FamilyNode key={root._id} personId={root._id} />
                 ))
             ) : (
                <div className="text-center mt-20">
                    <h2 className="text-2xl font-bold mb-4 text-gray-700">Il tuo albero è vuoto</h2>
                    <p className="text-gray-500 mb-8 max-w-md mx-auto">
                        Benvenuto! Inizia a costruire il tuo albero genealogico aggiungendo la prima persona.
                        Potrai poi aggiungere genitori e figli cliccando sui pulsanti + nelle schede.
                    </p>
                    <button 
                        className="btn btn-primary flex items-center gap-2 mx-auto text-lg px-6 py-3"
                        onClick={() => { setPendingRelation(null); setSelectedPerson(null); setShowModal(true); }}
                    >
                        <Plus size={24} /> Aggiungi Capostipite
                    </button>
                    <div className="mt-12 opacity-50 text-sm">
                        <p>Suggerimento: Un albero inizia dalle radici. Aggiungi il più anziano che conosci!</p>
                    </div>
                </div>
             )}
           </div>
        )}
      </main>
      
      {showModal && (
        <PersonModal 
            person={selectedPerson} 
            onSave={handleSavePerson} 
            onClose={() => setShowModal(false)} 
        />
      )}
    </div>
  );
}

export default TreeView;
