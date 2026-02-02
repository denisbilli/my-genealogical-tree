import React, { useState, useEffect, useRef } from 'react';
import { User, Plus, Trash2, LogOut, TreeDeciduous, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { authService, personService } from '../services/api';
import PersonModal from '../components/PersonModal';

function TreeView() {
  const [persons, setPersons] = useState([]); // List for selection/search
  const [treeLayout, setTreeLayout] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [pendingRelation, setPendingRelation] = useState(null); 
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  // On mount, load list of persons to find an entry point
  useEffect(() => {
    loadPersons();
  }, []);

  const loadPersons = async () => {
    try {
      const response = await personService.getAll();
      const allPersons = response.data;
      setPersons(allPersons);
      
      if (allPersons.length > 0) {
          // Heuristic: Find a good root (no parents)
          const root = allPersons.find(p => !p.parents || p.parents.length === 0) || allPersons[0];
          loadTree(root._id);
      } else {
          setLoading(false);
      }
    } catch (error) {
      console.error('Error loading persons:', error);
      setLoading(false);
    }
  };

  const loadTree = async (focusId) => {
      setLoading(true);
      try {
          const res = await personService.getTree(focusId);
          setTreeLayout(res.data);
      } catch (error) {
          console.error("Error loading tree layout", error);
      } finally {
          setLoading(false);
      }
  }

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  // --- Actions ---
  // Reuse existing logic, but refresh tree after save
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

  const initiateAddSibling = (person) => {
    setPendingRelation({ type: 'sibling', personId: person._id });
    setSelectedPerson(null);
    setShowModal(true);
  };

  const initiateAddPartner = (person) => {
    setPendingRelation({ type: 'partner', personId: person._id });
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
        loadPersons(); // Reloads all and resets tree
    } catch (error) {
        alert("Errore durante l'eliminazione");
    }
  };

  const handleSavePerson = async (formData) => {
    try {
      const currentRelation = pendingRelation?.type;

      if (currentRelation === 'edit') {
        await personService.update(selectedPerson._id, formData);
      } 
      
      else if (currentRelation === 'child') {
        // Legacy "parentIds" array is still parsed by backend, 
        // OR we can use the new addChildToUnion API conceptually, 
        // but for now, sticking to compatible Person Create is safest for migration.
        // The backend update we made didn't change the "Create Person" route to use Unions yet, 
        // BUT the GraphService builds Virtual Unions. So if we just create a person with parents, it works.
        const parentIds = [pendingRelation.personId]; 
        // If the current person is in a union, we probably want to include the spouse as parent?
        // Let's keep it simple: Link to this parent. The backend GraphService will show it as "Single Parent" or merge if we add the other later.
        
        await personService.create({ 
            ...formData, 
            parentIds: JSON.stringify(parentIds) 
        });
      } 
      
      else if (currentRelation === 'parent') {
        // Create Parent
        const newParentRes = await personService.create(formData);
        const newParent = newParentRes.data;
        
        // Link Child to Parent
        const child = persons.find(p => p._id === pendingRelation.personId);
        const currentParentIds = (child.parents || []).map(p => (p && typeof p === 'object' && p._id) ? p._id : p);
        
        await personService.update(child._id, { 
            parents: JSON.stringify([...currentParentIds, newParent._id]) 
        });
      } 
      
      else if (currentRelation === 'partner') {
         // Create Partner
         const payload = { ...formData, spouse: JSON.stringify([pendingRelation.personId]) };
         const newPartnerRes = await personService.create(payload);
         const newPartner = newPartnerRes.data;
         
         // Link Current -> Partner
         const currentPerson = persons.find(p => p._id === pendingRelation.personId);
         const currentSpouses = (currentPerson.spouse || []).map(p => (p && typeof p === 'object' && p._id) ? p._id : p);
         await personService.update(currentPerson._id, { 
             spouse: JSON.stringify([...currentSpouses, newPartner._id]) 
         });
      } 
      
      else if (currentRelation === 'sibling') {
        const currentPerson = persons.find(p => p._id === pendingRelation.personId);
        let parentIds = (currentPerson.parents || []).map(p => (p && typeof p === 'object' && p._id) ? p._id : p);
        
        if (parentIds.length === 0) {
            // Dummy Parent Logic
            const dummyParentRes = await personService.create({ 
                firstName: '?', lastName: '?', gender: 'other', notes: 'Auto-generated' 
            });
            parentIds = [dummyParentRes.data._id];
            await personService.update(currentPerson._id, { parents: JSON.stringify(parentIds) });
        }
        
        await personService.create({ ...formData, parentIds: JSON.stringify(parentIds) });
      } 
      
      else {
        // Plain create
        await personService.create(formData);
      }

      setShowModal(false);
      loadPersons(); // Reload tree
    } catch (error) {
      console.error('Save failed:', error);
      alert('Errore nel salvataggio');
    }
  };

  // --- Render Helpers ---

  const NodeCard = ({ node }) => {
    // We map 'node' which comes from layout back to 'person' structure
    // actually layout node contains all person fields.
    const isUnion = node.kind === 'union';

    if (isUnion) {
        // Render a small dot or heart for union
        return (
            <div 
                style={{ 
                    position: 'absolute', 
                    left: node.x, 
                    top: node.y,
                    transform: 'translate(-50%, -50%)',
                    width: 14, height: 14, 
                    borderRadius: '50%', 
                    backgroundColor: '#fda4af', // pink-300
                    border: '2px solid white',
                    zIndex: 5,
                    boxShadow: '0 0 0 1px #e5e7eb'
                }}
                title="Unione"
            />
        );
    }

    return (
        <div 
            className="node-card" 
            style={{ 
                position: 'absolute', 
                left: node.x, 
                top: node.y,
                transform: 'translate(-50%, -50%)', // Center on coordinate
                margin: 0, // Reset margin from CSS class
                border: node.isPartner ? '2px solid #fca5a5' : undefined 
            }}
        >
            {/* Add Parent Button */}
            <button className="btn-add-parent" onClick={(e) => { e.stopPropagation(); initiateAddParent(node); }} title="Aggiungi Genitore">
                <Plus size={14} />
            </button>

            {/* Add Partner Button */}
            <button className="btn-add-partner" onClick={(e) => { e.stopPropagation(); initiateAddPartner(node); }} title="Aggiungi Partner">
                <Plus size={14} />
            </button>

            {/* Add Sibling Button */}
            <button className="btn-add-sibling" onClick={(e) => { e.stopPropagation(); initiateAddSibling(node); }} title="Aggiungi Fratello">
                <Plus size={14} />
            </button>

            <div className="flex items-center gap-3">
                <div className="node-image-wrapper">
                    {node.photoUrl ? (
                        <img src={node.photoUrl} alt={node.firstName} className="node-image" />
                    ) : (
                        <User size={24} />
                    )}
                </div>
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <h3 style={{ fontWeight: 'bold', margin: 0, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {node.firstName} <span style={{ textTransform: 'uppercase', fontSize: '0.8rem', opacity: 0.7 }}>{node.lastName}</span>
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#666' }}>
                         {node.birthDate ? new Date(node.birthDate).getFullYear() : '?'} - {node.deathDate ? new Date(node.deathDate).getFullYear() : 'Presente'}
                    </p>
                </div>
                <div className="flex flex-col gap-1">
                     <button onClick={() => initiateEdit(node)} className="text-gray-400 hover:text-blue-500" title="Modifica">
                        <User size={14} />
                    </button>
                    <button onClick={() => deletePerson(node._id)} className="text-gray-400 hover:text-red-500" title="Elimina">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Add Child Button */}
            <button className="btn-add-child" onClick={(e) => { e.stopPropagation(); initiateAddChild(node); }} title="Aggiungi Figlio">
                <Plus size={14} />
            </button>
        </div>
    );
  };

  const renderEdges = () => {
      // Edges: { from, to, type }
      // Nodes map to find coords
      const nodeMap = new Map(treeLayout.nodes.map(n => [n._id, n]));

      return treeLayout.edges.map(edge => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;

          let pathD = '';
          if (edge.type === 'partner') {
              // Usually horizontal connection
              pathD = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
          } else {
              // Vertical (Child) connection
              // From Union/Person down to Child
              const midY = (from.y + to.y) / 2;
              pathD = `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
          }

          return (
              <path 
                key={edge.id} 
                d={pathD} 
                stroke="#cbd5e1" // gray-300
                strokeWidth="2"
                fill="none"
              />
          );
      });
  };

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
         {loading ? (
             <div className="flex items-center justify-center w-full h-full">Caricamento...</div>
         ) : (
            <TransformWrapper
                initialScale={0.8}
                minScale={0.1}
                maxScale={4}
                centerOnInit={true}
                limitToBounds={false}
            >
                {({ zoomIn, zoomOut, resetTransform }) => (
                    <React.Fragment>
                        <div className="absolute top-20 right-4 z-50 flex flex-col gap-2 bg-white/50 backdrop-blur p-2 rounded-lg shadow-sm">
                            <button onClick={() => zoomIn()} className="p-2 hover:bg-gray-200 rounded text-gray-700">+</button>
                            <button onClick={() => zoomOut()} className="p-2 hover:bg-gray-200 rounded text-gray-700">-</button>
                            <button onClick={() => resetTransform()} className="p-2 hover:bg-gray-200 rounded text-gray-700">R</button>
                        </div>
                        
                        <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full">
                            {/* Auto-sizing container based on min/max coords? For now nice big area */}
                            <div style={{ position: 'relative', width: 10000, height: 10000 }}>
                                
                                {/* Center the view on 5000,5000 initially via logic or just trust standard Layout */}
                                {/* Since layout is around 0,0, we should traverse nodes? */}
                                {/* Actually, GraphService layout produces coordinates relative to center (0,0). */}
                                {/* To render properly inside this div, we need to offset everything by width/2, height/2 */}
                                
                                <div style={{ position: 'absolute', top: '50%', left: '50%' }}>
                                     <svg style={{ position: 'absolute', overflow: 'visible', top: 0, left: 0 }}>
                                        {renderEdges()}
                                     </svg>
                                     {treeLayout.nodes.map(node => (
                                        <NodeCard key={node._id} node={node} />
                                     ))}
                                </div>
                            </div>
                        </TransformComponent>
                    </React.Fragment>
                )}
            </TransformWrapper>
         )}
      </main>

      {showModal && (
        <PersonModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            onSave={handleSavePerson}
            person={selectedPerson}
            title={selectedPerson ? 'Modifica Persona' : 'Aggiungi Persona'}
        />
      )}
    </div>
  );
}

export default TreeView;
