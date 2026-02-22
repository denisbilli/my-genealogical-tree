import React, { useState, useEffect, useCallback } from 'react';
import { Plus, LogOut, TreeDeciduous, Moon, Sun } from 'lucide-react';
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
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedNodeId, setHighlightedNodeId] = useState(null);

  // Expanded State (Instead of Collapsed)
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [focusPersonId, setFocusPersonId] = useState(null);
  
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  // Load dark mode preference
  useEffect(() => {
    const darkModePreference = localStorage.getItem('darkMode') === 'true';
    setIsDarkMode(darkModePreference);
    if (darkModePreference) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode.toString());
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSearch = (e) => {
      setSearchTerm(e.target.value);
      if (e.target.value === '') {
          setHighlightedNodeId(null);
      }
  };

  // Imposta una nuova radice e resetta le espansioni
  const handleSetRoot = (personId) => {
      setFocusPersonId(personId);
      setExpandedIds(new Set()); // Reset: mostra solo intorno al focus
  };

  // Espande o Collassa un nodo specifico (toggle)
  const handleExpandNode = (personId) => {
      setExpandedIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(personId)) {
              newSet.delete(personId); // Collassa
          } else {
              newSet.add(personId); // Espandi
          }
          return newSet;
      });
  };

  // Collassa tutto (torna alla vista base del focus corrente)
  const handleCollapseAll = () => {
      setExpandedIds(new Set());
  };

  // Reload tree when focus or expanded state changes
  useEffect(() => {
      if (focusPersonId) {
          loadTree(focusPersonId);
      } else if (persons.length > 0) {
          // Initialize with first person found as focus if none set
          const root = persons.find(p => !p.parents || p.parents.length === 0) || persons[0];
          setFocusPersonId(root._id);
      }
  }, [focusPersonId, expandedIds, persons.length]); // depend on persons.length to retry if empty initially

  const handleSelectSearchResult = (personId) => {
      // Quando cerco, voglio vedere quella persona. 
      // Opzione 1: Cambio il focus su di lei.
      setFocusPersonId(personId);
      setExpandedIds(new Set()); // Reset view around found person
      setHighlightedNodeId(personId);
      setSearchTerm('');
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
          // Set focus will trigger loadTree via useEffect
          setFocusPersonId(root._id);
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
      if (!focusId) return;
      setLoading(true);
      try {
          console.log(`Loading tree for focusId: ${focusId}`);
          
          const config = {
              expandedIds: expandedIds // Pass Set (api service will convert)
          };

          const res = await personService.getTree(focusId, config);
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
         // ADDITIVE LOGIC: Don't overwrite existing spouses
         // Note: Frontend state 'persons' might be incomplete or legacy. 
         // Best practice: Let the backend handle relationships via dedicated endpoint or ensuring arrays.
         
         // 1. Create the new person
         const payload = { ...formData }; // Do not set spouse here to avoid circular complexity initially
         const newPartnerRes = await personService.create(payload);
         const newPartner = newPartnerRes.data;
         
         // 2. Create the Union (Relationship)
         // We use the specific endpoint for creating relationships which handles Unions correctly
         // Instead of just updating "spouse" array (Legacy).
         // However, if we must use legacy update:
         try {
             const currentPerson = persons.find(p => p._id === pendingRelation.personId);
             let currentSpouses = [];
             if (currentPerson && currentPerson.spouse) {
                currentSpouses = currentPerson.spouse.map(p => (p && typeof p === 'object' && p._id) ? p._id : p);
             }
             
             // Add new partner ID
             currentSpouses.push(newPartner._id);
             
             // Update Current Person
             await personService.update(currentPerson._id, {
                 spouse: JSON.stringify(currentSpouses)
             });
             
             // Update Partner Person (reciprocal)
             await personService.update(newPartner._id, {
                 spouse: JSON.stringify([currentPerson._id])
             });
             
             // ALSO: Trigger Union Creation properly
             await personService.addRelationship(pendingRelation.personId, {
                 partnerId: newPartner._id,
                 type: 'relationship'
             });
             
         } catch (err) {
             console.error("Partner linking failed", err);
         }
      } 
      
      else if (currentRelation === 'sibling') {
        const currentPerson = persons.find(p => p._id === pendingRelation.personId);
        if (!currentPerson) {
             throw new Error("Persona di riferimento non trovata");
        }
        
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
              // Linee squadrate (Orthogonal) per i figli
              const midY = (fy + ty) / 2;
              // M start -> V middle -> H targetX -> V end
              pathD = `M ${fx} ${fy} V ${midY} H ${tx} V ${ty}`;
              
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
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-light)', display: 'flex', flexDirection: 'column' }}>
      <header className="app-header sticky top-0 z-50">
        <div className="app-title">
           <TreeDeciduous size={24} color="var(--primary)" />
           <span>Heritg.org</span>
        </div>

        {/* Search Bar - CENTERED */}
        <div className="flex-1 max-w-md mx-4 relative hidden md:block">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              border: '1px solid var(--border-color)',
              borderRadius: '9999px',
              padding: '0.375rem 1rem',
              backgroundColor: 'var(--bg-secondary)',
              transition: 'all 0.2s'
            }}>
                <input 
                    type="text" 
                    placeholder="Cerca in famiglia..." 
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: '0.875rem',
                      width: '100%',
                      color: 'var(--text-main)'
                    }}
                    value={searchTerm}
                    onChange={handleSearch}
                />
                {searchTerm && (
                        <button 
                          onClick={() => { setSearchTerm(''); setHighlightedNodeId(null); }} 
                          style={{
                            color: 'var(--text-secondary)',
                            marginLeft: '0.5rem',
                            cursor: 'pointer',
                            background: 'none',
                            border: 'none',
                            fontSize: '1.25rem'
                          }}
                        >
                            ×
                        </button>
                )}
            </div>
            
            {/* Search Results Dropdown */}
            {searchTerm && filteredPersons.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '0.5rem',
                  width: '100%',
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.75rem',
                  boxShadow: '0 20px 25px -5px var(--shadow-color)',
                  maxHeight: '20rem',
                  overflowY: 'auto',
                  zIndex: 100
                }}>
                    {filteredPersons.map(p => (
                        <div 
                            key={p._id}
                            style={{
                              padding: '0.75rem',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              borderBottom: '1px solid var(--border-color)',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            onClick={() => handleSelectSearchResult(p._id)}
                        >
                            {p.photoUrl ? (
                                <img src={p.photoUrl} alt="" style={{ width: '2rem', height: '2rem', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                            ) : (
                                <div style={{ 
                                  width: '2rem', 
                                  height: '2rem', 
                                  borderRadius: '50%', 
                                  backgroundColor: 'var(--bg-secondary)', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  color: 'var(--primary)', 
                                  fontWeight: 'bold', 
                                  border: '1px solid var(--border-color)' 
                                }}>
                                    {p.firstName[0]}
                                </div>
                            )}
                            <div>
                                <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{p.firstName} {p.lastName}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
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
             
             {/* Dark Mode Toggle */}
             <button
               onClick={toggleDarkMode}
               className="p-2 rounded-full transition-colors"
               title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
               style={{ backgroundColor: 'var(--bg-secondary)' }}
             >
               {isDarkMode ? <Sun size={20} color="var(--primary)" /> : <Moon size={20} color="var(--primary)" />}
             </button>
             
             <button 
               onClick={() => navigate('/dashboard')}
               className="btn btn-secondary text-xs"
               style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)' }}
             >
                Dashboard
             </button>
             <span className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>Ciao, {user?.fullName || 'Utente'}</span>
             <button 
               onClick={() => { authService.logout(); navigate('/login'); }} 
               className="btn btn-danger p-2 rounded-full" 
               title="Logout"
             >
                <LogOut size={20} />
             </button>
        </div>
      </header>

      <main className="tree-wrapper flex-1 overflow-hidden" style={{ cursor: 'grab' }}>
        <ErrorBoundary>
         {loading ? (
             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--text-main)' }}>Caricamento...</div>
         ) : persons.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', gap: '1rem' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Non ci sono ancora persone nel tuo albero.</p>
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
                        <div className="absolute top-20 right-4 z-50 flex flex-col gap-2 p-2 rounded-lg shadow-sm" style={{ backgroundColor: 'var(--card-bg)', backdropFilter: 'blur(8px)' }}>
                            <button onClick={() => zoomIn()} className="p-2 rounded" style={{ color: 'var(--text-main)', backgroundColor: 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>+</button>
                            <button onClick={() => zoomOut()} className="p-2 rounded" style={{ color: 'var(--text-main)', backgroundColor: 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>-</button>
                            <button onClick={() => resetTransform()} className="p-2 rounded" style={{ color: 'var(--text-main)', backgroundColor: 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>R</button>
                        </div>
                        
                        {/* Legenda tipi di relazione */}
                        <div className="absolute top-20 left-4 z-50 rounded-lg shadow-md p-3 text-sm" style={{ backgroundColor: 'var(--card-bg)' }}>
                            <div className="font-semibold mb-2" style={{ color: 'var(--text-main)' }}>Legenda:</div>
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                    <svg width="30" height="2">
                                        <line x1="0" y1="1" x2="30" y2="1" stroke="#ec4899" strokeWidth="3" />
                                    </svg>
                                    <span style={{ color: 'var(--text-secondary)' }}>Partner</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <svg width="30" height="2">
                                        <line x1="0" y1="1" x2="30" y2="1" stroke="#3b82f6" strokeWidth="2" />
                                    </svg>
                                    <span style={{ color: 'var(--text-secondary)' }}>Figlio biologico</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <svg width="30" height="2">
                                        <line x1="0" y1="1" x2="30" y2="1" stroke="#f59e0b" strokeWidth="2" strokeDasharray="6,4" />
                                    </svg>
                                    <span style={{ color: 'var(--text-secondary)' }}>Figlio acquisito</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <svg width="30" height="2">
                                        <line x1="0" y1="1" x2="30" y2="1" stroke="#10b981" strokeWidth="2" strokeDasharray="3,3" />
                                    </svg>
                                    <span style={{ color: 'var(--text-secondary)' }}>Figlio adottivo</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <svg width="30" height="2">
                                        <line x1="0" y1="1" x2="30" y2="1" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="8,4" />
                                    </svg>
                                    <span style={{ color: 'var(--text-secondary)' }}>Figlio in affido</span>
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
                                            isFocus={node._id === focusPersonId}
                                            onAddParent={initiateAddParent}
                                            onAddPartner={initiateAddPartner}
                                            onAddSibling={initiateAddSibling}
                                            onAddChild={initiateAddChild}
                                            onEdit={initiateEdit}
                                            onDelete={deletePerson}
                                            onUnionClick={handleUnionClick}
                                            onSetFocus={handleSetRoot}
                                            onExpandNode={handleExpandNode}
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
