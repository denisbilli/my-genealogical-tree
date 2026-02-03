import React, { useState, useEffect, useCallback } from 'react';
import { Plus, LogOut, TreeDeciduous } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { authService, personService } from '../services/api';
import PersonModal from '../components/PersonModal';
import NodeCard from '../components/NodeCard';
import UnionModal from '../components/UnionModal';
import ErrorBoundary from '../components/ErrorBoundary';

function TreeView() {
  const [persons, setPersons] = useState([]); 
  const [treeLayout, setTreeLayout] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [pendingRelation, setPendingRelation] = useState(null);
  const [showUnionModal, setShowUnionModal] = useState(false);
  const [selectedUnion, setSelectedUnion] = useState(null);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedNodeId, setHighlightedNodeId] = useState(null);
  
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  const handleSearch = (e) => {
      setSearchTerm(e.target.value);
      if (e.target.value === '') {
          setHighlightedNodeId(null);
      }
  };

  const handleSelectSearchResult = (personId) => {
      setHighlightedNodeId(personId);
      setSearchTerm(''); // Clear search or keep it? Keeping it clears the dropdown
      
      // Funzionalità opzionale: centra la vista sul nodo
      // Richiede accesso al ref di transformComponent -> useTransform() o ref diretto
      // Per semplicità ora usiamo solo highlighting
  };

  const filteredPersons = searchTerm 
      ? persons.filter(p => 
          (p.firstName + ' ' + p.lastName).toLowerCase().includes(searchTerm.toLowerCase())
        )
      : [];

  // Helper to calculate graph bounds for centering
  const getGraphBounds = () => {
      if (!treeLayout.nodes || treeLayout.nodes.length === 0) {
          return { width: 800, height: 600, minX: -400, minY: -300 }; // Default dummy bounds
      }

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      treeLayout.nodes.forEach(node => {
          if (node.x < minX) minX = node.x;
          if (node.x > maxX) maxX = node.x;
          if (node.y < minY) minY = node.y;
          if (node.y > maxY) maxY = node.y;
      });

      // Add padding (node width aprox 250, height 100)
      // Reduced padding to keep canvas tighter to content
      const paddingX = 150; 
      const paddingY = 100;

      return {
          minX: minX - paddingX,
          maxX: maxX + paddingX,
          minY: minY - paddingY,
          maxY: maxY + paddingY,
          width: (maxX - minX) + (paddingX * 2),
          height: (maxY - minY) + (paddingY * 2)
      };
  };

  const bounds = getGraphBounds();

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

  const handleUnionClick = useCallback((unionNode) => {
    setSelectedUnion(unionNode);
    setShowUnionModal(true);
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

          // Shift coordinates to be relative to Bounds top-left
          const fx = from.x - bounds.minX;
          const fy = from.y - bounds.minY;
          const tx = to.x - bounds.minX;
          const ty = to.y - bounds.minY;

          let pathD = '';
          let strokeColor = '#cbd5e1'; // default gray
          let strokeWidth = '2';
          let strokeDasharray = '';

          if (edge.type === 'partner') {
              // Linea dritta per i partner (rosa)
              pathD = `M ${fx} ${fy} L ${tx} ${ty}`;
              strokeColor = '#ec4899'; // Rosa per partner
              strokeWidth = '3';
          } else {
              // Curva per i figli
              const midY = (fy + ty) / 2;
              pathD = `M ${fx} ${fy} C ${fx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;
              
              // Colori e stili in base al tipo di parentela
              if (edge.parentalType === 'bio') {
                  strokeColor = '#3b82f6'; // Blu solido per biologico
                  strokeWidth = '2';
              } else if (edge.parentalType === 'step') {
                  strokeColor = '#f59e0b'; // Arancione tratteggiato per step-parent
                  strokeWidth = '2';
                  strokeDasharray = '6,4';
              } else if (edge.parentalType === 'adoptive') {
                  strokeColor = '#10b981'; // Verde per adottivo
                  strokeWidth = '2';
                  strokeDasharray = '3,3';
              } else if (edge.parentalType === 'foster') {
                  strokeColor = '#8b5cf6'; // Viola per affido
                  strokeWidth = '2';
                  strokeDasharray = '8,4';
              }
          }

          return (
              <path 
                key={edge.id} 
                d={pathD} 
                stroke={strokeColor} 
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                fill="none"
                style={{ transition: 'stroke 0.2s ease' }}
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

        {/* Search Bar - CENTERED */}
        <div className="flex-1 max-w-md mx-4 relative hidden md:block">
            <div className="flex items-center border rounded-full px-4 py-1.5 bg-gray-50 focus-within:ring-2 focus-within:ring-pink-100 focus-within:border-pink-300 transition-all">
                <input 
                    type="text" 
                    placeholder="Cerca in famiglia..." 
                    className="bg-transparent border-none outline-none text-sm w-full"
                    value={searchTerm}
                    onChange={handleSearch}
                />
                {searchTerm && (
                        <button onClick={() => { setSearchTerm(''); setHighlightedNodeId(null); }} className="text-gray-400 hover:text-gray-600 ml-2">
                            ×
                        </button>
                )}
            </div>
            
            {/* Search Results Dropdown */}
            {searchTerm && filteredPersons.length > 0 && (
                <div className="absolute top-full left-0 mt-2 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-80 overflow-y-auto z-[100]">
                    {filteredPersons.map(p => (
                        <div 
                            key={p._id}
                            className="p-3 hover:bg-pink-50 cursor-pointer text-sm flex items-center gap-3 border-b border-gray-50 last:border-b-0 transition-colors"
                            onClick={() => handleSelectSearchResult(p._id)}
                        >
                            {p.photoUrl ? (
                                <img src={p.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-500 font-bold border border-pink-200">
                                    {p.firstName[0]}
                                </div>
                            )}
                            <div>
                                <div className="font-semibold text-gray-800">{p.firstName} {p.lastName}</div>
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                    <span>Nascita: {p.birthDate ? new Date(p.birthDate).getFullYear() : '?'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
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
             <button 
               onClick={() => navigate('/dashboard')}
               className="btn btn-secondary text-xs"
               style={{ backgroundColor: '#e5e7eb', color: '#1f2937' }}
             >
                Dashboard
             </button>
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
                minScale={0.2}
                maxScale={2}
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
                        
                        {/* Legenda tipi di relazione */}
                        <div className="absolute top-20 left-4 z-50 bg-white rounded-lg shadow-md p-3 text-sm">
                            <div className="font-semibold mb-2 text-gray-700">Legenda:</div>
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                    <svg width="30" height="2">
                                        <line x1="0" y1="1" x2="30" y2="1" stroke="#ec4899" strokeWidth="3" />
                                    </svg>
                                    <span className="text-gray-600">Partner</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <svg width="30" height="2">
                                        <line x1="0" y1="1" x2="30" y2="1" stroke="#3b82f6" strokeWidth="2" />
                                    </svg>
                                    <span className="text-gray-600">Figlio biologico</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <svg width="30" height="2">
                                        <line x1="0" y1="1" x2="30" y2="1" stroke="#f59e0b" strokeWidth="2" strokeDasharray="6,4" />
                                    </svg>
                                    <span className="text-gray-600">Figlio acquisito</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <svg width="30" height="2">
                                        <line x1="0" y1="1" x2="30" y2="1" stroke="#10b981" strokeWidth="2" strokeDasharray="3,3" />
                                    </svg>
                                    <span className="text-gray-600">Figlio adottivo</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <svg width="30" height="2">
                                        <line x1="0" y1="1" x2="30" y2="1" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="8,4" />
                                    </svg>
                                    <span className="text-gray-600">Figlio in affido</span>
                                </div>
                            </div>
                        </div>
                        
                        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                            {/* Render using calculated specific bounds */}
                            <div style={{ position: 'relative', width: bounds.width, height: bounds.height }}>
                                     {/* Canvas Background to show bounds */}
                                     {/* <div style={{ position: 'absolute', inset: 0, border: '1px dashed #e5e7eb', pointerEvents: 'none' }} /> */}
                                     
                                     <svg style={{ position: 'absolute', overflow: 'visible', top: 0, left: 0, width: '100%', height: '100%' }}>
                                        {renderEdges()}
                                     </svg>
                                     {treeLayout.nodes.map(node => (
                                        <NodeCard 
                                            key={node._id} 
                                            // Pass modified coordinates shifted by bounds
                                            node={{ ...node, x: node.x - bounds.minX, y: node.y - bounds.minY }}
                                            isHighlighted={node._id === highlightedNodeId}
                                            onAddParent={initiateAddParent}
                                            onAddPartner={initiateAddPartner}
                                            onAddSibling={initiateAddSibling}
                                            onAddChild={initiateAddChild}
                                            onEdit={handleEditPerson}
                                            onDelete={handleDeletePerson}
                                            onUnionClick={handleUnionClick}
                                        />
                                     ))}
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

      {showUnionModal && selectedUnion && (
        <UnionModal
            union={selectedUnion}
            onClose={() => {
                setShowUnionModal(false);
                setSelectedUnion(null);
            }}
            onUpdate={() => {
                loadPersons(); // Ricarica l'albero dopo modifiche
            }}
        />
      )}
    </div>
  );
}

export default TreeView;
