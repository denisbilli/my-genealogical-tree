import React, { useState, useEffect } from 'react';
import { User, Plus, Trash2, LogOut, RefreshCw, TreeDeciduous } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
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
        // 1. Create the new person (the parent)
        const newParentRes = await personService.create(formData);
        const newParent = newParentRes.data;
        
        // 2. Update the child (current node) to include this new parent
        const child = persons.find(p => p._id === pendingRelation.personId);
        
        // Ensure we have an array of IDs, handling populated objects if necessary
        const currentParentIds = (child.parents || []).map(p => 
            (p && typeof p === 'object' && p._id) ? p._id : p
        );
        
        // Add new parent ID
        const updatedParentIds = [...currentParentIds, newParent._id];

        // Send as JSON string because our partial backend fix expects that or parses it
        await personService.update(child._id, {
            parents: JSON.stringify(updatedParentIds) 
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


  // Find partners: people who are co-parents of this person's children
  const getPartners = (personId) => {
    // 1. Find all children of personId
    const children = persons.filter(p => 
        p.parents && p.parents.some(parent => 
            (typeof parent === 'object' ? parent._id : parent) === personId
        )
    );

    // 2. For these children, find OTHER parents
    const partnerIds = new Set();
    children.forEach(child => {
        if (!child.parents) return;
        child.parents.forEach(p => {
            const pId = typeof p === 'object' ? p._id : p;
            if (pId !== personId) {
                partnerIds.add(pId);
            }
        });
    });

    return Array.from(partnerIds).map(id => persons.find(p => p._id === id)).filter(Boolean);
  };

  const FamilyNode = ({ personId }) => {
    const person = persons.find(p => p._id === personId);
    if (!person) return null;

    const partners = getPartners(personId);

    // Filter out partners that have a lower ID than current person to avoid cycles if both are rendered technically
    // But since we control the entry point via rootNodes, we just render all partners found here alongside the main person.
    
    // Find children of this Family Unit (Children of Person OR Partners)
    // We only want children that belong to THIS couple if we were strict, but for simplicity, we show all children of the primary person.
    // If we want to show shared children, we check if child has parentId.
    
    const children = persons.filter(p => 
      p.parents && p.parents.some(parent => 
        (typeof parent === 'object' ? parent._id : parent) === personId
      )
    );

    return (
      <div className="tree-node">
        {/* Node or Couple Container */}
        <div className="flex gap-4 relative">
            {/* Primary Person */}
            <NodeCard person={person} />
            
            {/* Partners */}
            {partners.map(partner => (
                <div key={partner._id} className="relative">
                    {/* Visual Connector for Marriage */}
                    <div className="absolute top-1/2 -left-3 w-2 h-1 bg-red-300"></div>
                    <NodeCard person={partner} isPartner />
                </div>
            ))}
        </div>

        {/* Children */ }
        {children.length > 0 && (
            <div className="flex flex-col items-center">
                <div className="connector-line-vertical"></div>
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

  const NodeCard = ({ person, isPartner }) => (
        <div className="node-card" style={isPartner ? { borderColor: '#fca5a5' } : {}}>
            {/* Add Parent Button - Only for Primary node to avoid confusion or allow adding parents to partner too? Let's allow only on primary for now to keep tree simple */}
            {!isPartner && (
            <button 
                className="btn-add-parent"
                onClick={(e) => { e.stopPropagation(); initiateAddParent(person); }}
                title="Aggiungi Genitore"
            >
                <Plus size={14} />
            </button>
            )}

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
            {!isPartner && (
            <button 
                className="btn-add-child"
                onClick={(e) => { e.stopPropagation(); initiateAddChild(person); }}
                title="Aggiungi Figlio"
            >
                <Plus size={14} />
            </button>
            )}
        </div>
  );

  // Filter Root Nodes:
  // 1. Must have NO parents.
  // 2. If part of a couple (partner is also a root), only one should be the "primary" root.
  // We can sort by ID and pick the smaller one to be deterministic.
  const rootNodes = persons.filter(p => {
      // Must be a root (no parents)
      const isRoot = !p.parents || p.parents.length === 0;
      if (!isRoot) return false;

      // Check partners
      const partners = getPartners(p._id);
      const rootPartners = partners.filter(part => !part.parents || part.parents.length === 0);
      
      if (rootPartners.length > 0) {
          // If I have a partner who is also a root.
          // Only render if my ID is smaller than all my root partners' IDs.
          const amILeader = rootPartners.every(rp => p._id < rp._id);
          return amILeader;
      }
      
      return true;
  });


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
      
      <main className="tree-wrapper flex-1 overflow-hidden" style={{ cursor: 'grab' }}>
        {loading && persons.length === 0 ? (
           <div className="flex items-center justify-center w-full h-full">Caricamento...</div>
        ) : (
           <TransformWrapper
             initialScale={1}
             initialPositionX={0}
             initialPositionY={0}
             minScale={0.1}
             maxScale={4}
             centerOnInit={true}
           >
             {({ zoomIn, zoomOut, resetTransform }) => (
               <React.Fragment>
                  <div className="absolute top-20 right-4 z-50 flex flex-col gap-2 bg-white/50 backdrop-blur p-2 rounded-lg shadow-sm">
                    <button onClick={() => zoomIn()} className="p-2 hover:bg-gray-200 rounded text-gray-700" title="Zoom In">+</button>
                    <button onClick={() => zoomOut()} className="p-2 hover:bg-gray-200 rounded text-gray-700" title="Zoom Out">-</button>
                    <button onClick={() => resetTransform()} className="p-2 hover:bg-gray-200 rounded text-gray-700" title="Reset">R</button>
                  </div>

                  <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full flex items-center justify-center">
                    <div className="flex gap-16 p-20">
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
                  </TransformComponent>
               </React.Fragment>
             )}
           </TransformWrapper>
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
