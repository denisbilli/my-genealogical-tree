import React, { useState, useEffect, useCallback } from 'react';
import { Plus, LogOut, TreeDeciduous } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { authService, personService } from '../services/api';
import PersonModal from '../components/PersonModal';
import NodeCard from '../components/NodeCard';
import ErrorBoundary from '../components/ErrorBoundary';

function TreeView() {
  const [persons, setPersons] = useState([]); 
  const [treeLayout, setTreeLayout] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [pendingRelation, setPendingRelation] = useState(null); 
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  // On mount, load list of persons
  useEffect(() => {
    console.log("TreeView Mounted");
    loadPersons();
  }, []);

  const loadPersons = async () => {
    try {
      console.log("Loading persons...");
      const response = await personService.getAll();
      const allPersons = response.data;
      console.log("Persons loaded:", allPersons);
      setPersons(allPersons);
      
      if (allPersons.length > 0) {
          // Heuristic: Find a good root (no parents)
          const root = allPersons.find(p => !p.parents || p.parents.length === 0) || allPersons[0];
          console.log("Selected root:", root.firstName, root._id);
          loadTree(root._id);
      } else {
          console.log("No persons found, showing empty state.");
          setLoading(false);
          setTreeLayout({ nodes: [], edges: [] });
      }
    } catch (error) {
      console.error('Error loading persons:', error);
      setLoading(false);
    }
  };

  const loadTree = async (focusId) => {
      setLoading(true);
      try {
          console.log(`Loading tree for focusId: ${focusId}`);
          const res = await personService.getTree(focusId);
          console.log("Tree data received:", res.data);
          
          // Safety check: ensure arrays
          const safeData = {
              nodes: Array.isArray(res.data.nodes) ? res.data.nodes : [],
              edges: Array.isArray(res.data.edges) ? res.data.edges : []
          };
          setTreeLayout(safeData);
      } catch (error) {
          console.error("Error loading tree layout", error);
      } finally {
          setLoading(false);
      }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  // --- Handlers (Memoization optional but good) ---
  const initiateAddParent = useCallback((node) => {
    setPendingRelation({ type: 'parent', personId: node._id });
    setSelectedPerson(null);
    setShowModal(true);
  }, []);

  const initiateAddChild = useCallback((node) => {
    setPendingRelation({ type: 'child', personId: node._id });
    setSelectedPerson(null);
    setShowModal(true);
  }, []);

  const initiateAddSibling = useCallback((node) => {
    setPendingRelation({ type: 'sibling', personId: node._id });
    setSelectedPerson(null);
    setShowModal(true);
  }, []);

  const initiateAddPartner = useCallback((node) => {
    setPendingRelation({ type: 'partner', personId: node._id });
    setSelectedPerson(null);
    setShowModal(true);
  }, []);

  const initiateEdit = useCallback((node) => {
    setPendingRelation({ type: 'edit', personId: node._id });
    setSelectedPerson(node);
    setShowModal(true);
  }, []);

  const deletePerson = useCallback(async (id) => {
    if (!window.confirm("Sei sicuro di voler eliminare questa persona?")) return;
    try {
        await personService.delete(id);
        // Reloads all and resets tree
        await loadPersons(); 
    } catch (error) {
        alert("Errore durante l'eliminazione");
    }
  }, []); // Recursion warning: loadPersons needs to be stable or ignored in dependency array if fine

  const handleSavePerson = async (formData) => {
    try {
      const currentRelation = pendingRelation?.type;

      if (currentRelation === 'edit') {
        const updatePayload = { ...formData };
        if (selectedPerson) {
             await personService.update(selectedPerson._id, updatePayload);
        }
      } 
      
      else if (currentRelation === 'child') {
        const parentIds = [pendingRelation.personId]; 
        await personService.create({ 
            ...formData, 
            parentIds: JSON.stringify(parentIds) 
        });
      } 
      
      else if (currentRelation === 'parent') {
        const newParentRes = await personService.create(formData);
        const newParent = newParentRes.data;
        const child = persons.find(p => p._id === pendingRelation.personId);
        
        let currentParentIds = [];
        if (child && child.parents) {
             // Handle both object populate and string ID
             currentParentIds = child.parents.map(p => (p && typeof p === 'object' && p._id) ? p._id : p);
        }
        
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
         let currentSpouses = [];
         if (currentPerson && currentPerson.spouse) {
            currentSpouses = currentPerson.spouse.map(p => (p && typeof p === 'object' && p._id) ? p._id : p);
         }

         await personService.update(currentPerson._id, { 
             spouse: JSON.stringify([...currentSpouses, newPartner._id]) 
         });
      } 
      
      else if (currentRelation === 'sibling') {
        const currentPerson = persons.find(p => p._id === pendingRelation.personId);
        let parentIds = [];
        if (currentPerson && currentPerson.parents) {
            parentIds = currentPerson.parents.map(p => (p && typeof p === 'object' && p._id) ? p._id : p);
        }
        
        if (parentIds.length === 0) {
            // Create dummy parent
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
      alert('Errore nel salvataggio: ' + error.message);
    }
  };

  const renderEdges = () => {
      if (!treeLayout.nodes || treeLayout.nodes.length === 0) return null;

      const nodeMap = new Map((treeLayout.nodes || []).map(n => [n._id, n]));

      return (treeLayout.edges || []).map(edge => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;

          let pathD = '';
          if (edge.type === 'partner') {
              pathD = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
          } else {
              const midY = (from.y + to.y) / 2;
              pathD = `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
          }

          return (
              <path 
                key={edge.id} 
                d={pathD} 
                stroke="#cbd5e1" 
                strokeWidth="2"
                fill="none"
              />
          );
      });
  };

  console.log("Render TreeView. State:", { loading, personCount: persons.length, treeNodes: treeLayout.nodes?.length });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column' }}>
      <header className="app-header sticky top-0 z-50">
        <div className="app-title">
           <TreeDeciduous size={24} color="var(--primary)" />
           <span>Heritg.org</span>
        </div>
        <div className="flex items-center gap-4">
             {persons.length > 0 && (
                <button 
                  onClick={() => { setSelectedPerson(null); setPendingRelation(null); setShowModal(true); }}
                  className="btn btn-primary text-xs"
                >
                  <Plus size={16} /> Nuova Persona
                </button>
             )}
             <span className="text-sm font-medium">Ciao, {user?.fullName || 'Utente'}</span>
             <button onClick={handleLogout} className="btn btn-danger p-2 rounded-full" title="Logout">
                <LogOut size={20} />
             </button>
        </div>
      </header>

      <main className="tree-wrapper flex-1 overflow-hidden" style={{ cursor: 'grab' }}>
        <ErrorBoundary>
         {loading ? (
             <div className="flex items-center justify-center w-full h-full">Caricamento...</div>
         ) : persons.length === 0 ? (
            <div className="flex flex-col items-center justify-center w-full h-full gap-4">
                <p className="text-gray-500 mb-2">Non ci sono ancora persone nel tuo albero.</p>
                <button 
                  onClick={() => { setSelectedPerson(null); setPendingRelation(null); setShowModal(true); }}
                  className="btn btn-primary"
                >
                  <Plus size={20} /> Aggiungi la prima persona
                </button>
            </div>
         ) : (
            <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={2}
                centerOnInit={false}
                limitToBounds={false}
                wheel={{ step: 0.1 }}
            >
                {({ zoomIn, zoomOut, resetTransform }) => (
                    <React.Fragment>
                        <div className="absolute top-20 right-4 z-50 flex flex-col gap-2 bg-white/50 backdrop-blur p-2 rounded-lg shadow-sm">
                            <button onClick={() => zoomIn()} className="p-2 hover:bg-gray-200 rounded text-gray-700">+</button>
                            <button onClick={() => zoomOut()} className="p-2 hover:bg-gray-200 rounded text-gray-700">-</button>
                            <button onClick={() => resetTransform()} className="p-2 hover:bg-gray-200 rounded text-gray-700">R</button>
                            <div className="text-xs text-gray-500 p-2 border-t">
                                Nodes: {treeLayout.nodes?.length || 0}<br/>
                                Edges: {treeLayout.edges?.length || 0}
                            </div>
                        </div>
                        
                        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%" }}>
                            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                {/* Center Anchor: Moves origin to center of viewport */}
                                <div style={{ 
                                    position: 'absolute', 
                                    top: '50%', 
                                    left: '50%', 
                                    width: 0, 
                                    height: 0, 
                                    overflow: 'visible' 
                                }}>
                                     {/* Center Marker for Debug */}
                                     <div style={{ 
                                        position: 'absolute', 
                                        width: 10, height: 10, 
                                        backgroundColor: 'red', 
                                        borderRadius: '50%', 
                                        transform: 'translate(-50%, -50%)',
                                        zIndex: 1000
                                     }} />

                                     <svg style={{ position: 'absolute', overflow: 'visible', top: 0, left: 0 }}>
                                        {renderEdges()}
                                     </svg>
                                     {treeLayout.nodes.map(node => (
                                        <NodeCard 
                                            key={node._id} 
                                            node={node} 
                                            onAddParent={initiateAddParent}
                                            onAddPartner={initiateAddPartner}
                                            onAddSibling={initiateAddSibling}
                                            onAddChild={initiateAddChild}
                                            onEdit={initiateEdit}
                                            onDelete={deletePerson}
                                        />
                                     ))}
                                </div>
                            </div>
                        </TransformComponent>
                    </React.Fragment>
                )}
            </TransformWrapper>
         )}
        </ErrorBoundary>
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
