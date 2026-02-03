import React, { memo } from 'react';
import { User, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

// Memoized NodeCard Component
const NodeCard = memo(({ 
    node, 
    onAddParent, 
    onAddPartner, 
    onAddSibling, 
    onAddChild, 
    onEdit, 
    onDelete,
    onUnionClick,
    onToggleCollapse,
    isHighlighted
}) => {
    // console.log("Rendering Node:", node._id, node.firstName, node.x, node.y);
    // We map 'node' which comes from layout back to 'person' structure
    // actually layout node contains all person fields.
    const isUnion = node.kind === 'union';

    if (isUnion) {
        // Render a small dot or heart for union - clickable
        return (
            <div 
                onClick={() => onUnionClick && onUnionClick(node)}
                style={{ 
                    position: 'absolute', 
                    left: node.x, 
                    top: node.y,
                    transform: 'translate(-50%, -50%)',
                    width: 20, height: 20, 
                    borderRadius: '50%', 
                    backgroundColor: '#ec4899', // pink-500
                    border: '3px solid white',
                    zIndex: 5,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.2)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(236,72,153,0.4)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                }}
                title="Clicca per gestire i figli di questa unione"
            />
        );
    }

    // Safety check for date
    let yearRange = '? - Presente';
    try {
        const birthYear = node.birthDate ? new Date(node.birthDate).getFullYear() : '?';
        const deathYear = node.deathDate ? new Date(node.deathDate).getFullYear() : 'Presente';
        yearRange = `${Number.isNaN(birthYear) ? '?' : birthYear} - ${Number.isNaN(deathYear) && deathYear !== 'Presente' ? '?' : deathYear}`;
    } catch(e) {
        // fallback
    }

    return (
        <div 
            className="node-card group" 
            style={{ 
                position: 'absolute', 
                left: node.x, 
                top: node.y,
                transform: 'translate(-50%, -50%)', // Center on coordinate
                margin: 0, // Reset margin from CSS class
                border: isHighlighted ? '4px solid #fcd34d' : (node.isPartner ? '2px solid #fca5a5' : undefined),
                boxShadow: isHighlighted ? '0 0 15px rgba(252, 211, 77, 0.8)' : undefined,
                width: 250, // Fixed width
                height: 100, // Fixed height
                zIndex: isHighlighted ? 10 : 1,
                backgroundColor: isHighlighted ? '#fffbeb' : 'white'
            }}
        >
            {/* Collapse Buttons */}
            {/* Top - Hide Ancestors - Moved to Right to avoid overlap with + button */}
            <button 
                onClick={(e) => { e.stopPropagation(); onToggleCollapse(node._id, 'up'); }}
                className={`absolute -top-3 right-8 w-6 h-6 rounded-full border border-gray-200 bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors z-20 ${node.isCollapsedAncestors ? 'bg-blue-100 border-blue-300' : ''}`}
                title={node.isCollapsedAncestors ? "Mostra antenati" : "Nascondi antenati"}
            >
                <ChevronUp size={14} className={node.isCollapsedAncestors ? "text-blue-600 rotate-180" : "text-gray-500"} />
            </button>

            {/* Bottom - Hide Descendants - Moved to Right to avoid overlap with + button */}
            <button 
                onClick={(e) => { e.stopPropagation(); onToggleCollapse(node._id, 'down'); }}
                className={`absolute -bottom-3 right-8 w-6 h-6 rounded-full border border-gray-200 bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors z-20 ${node.isCollapsedDescendants ? 'bg-blue-100 border-blue-300' : ''}`}
                title={node.isCollapsedDescendants ? "Mostra discendenti" : "Nascondi discendenti"}
            >
                <ChevronDown size={14} className={node.isCollapsedDescendants ? "text-blue-600 rotate-180" : "text-gray-500"} />
            </button>

            {/* Add Parent Button */}
            <button className="btn-add-parent" onClick={(e) => { e.stopPropagation(); onAddParent(node); }} title="Aggiungi Genitore">
                <Plus size={14} />
            </button>

            {/* Add Partner Button */}
            <button className="btn-add-partner" onClick={(e) => { e.stopPropagation(); onAddPartner(node); }} title="Aggiungi Partner">
                <Plus size={14} />
            </button>

            {/* Add Sibling Button */}
            <button className="btn-add-sibling" onClick={(e) => { e.stopPropagation(); onAddSibling(node); }} title="Aggiungi Fratello">
                <Plus size={14} />
            </button>

            <div className="flex items-center gap-3 w-full h-full p-2">
                <div className="node-image-wrapper flex-shrink-0">
                    {node.photoUrl ? (
                        <img 
                            src={node.photoUrl} 
                            alt={node.firstName} 
                            className="node-image" 
                            onError={(e) => { e.target.onerror = null; e.target.src = '' /* fallback? */; }}
                        />
                    ) : (
                        <User size={24} />
                    )}
                </div>
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <h3 style={{ fontWeight: 'bold', margin: 0, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {node.firstName} <span style={{ textTransform: 'uppercase', fontSize: '0.8rem', opacity: 0.7 }}>{node.lastName}</span>
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#666' }}>
                         {yearRange}
                    </p>
                </div>
                <div className="flex flex-col gap-1">
                     <button onClick={() => onEdit(node)} className="text-gray-400 hover:text-blue-500" title="Modifica">
                        <User size={14} />
                    </button>
                    <button onClick={() => onDelete(node._id)} className="text-gray-400 hover:text-red-500" title="Elimina">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Add Child Button */}
            <button className="btn-add-child" onClick={(e) => { e.stopPropagation(); onAddChild(node); }} title="Aggiungi Figlio">
                <Plus size={14} />
            </button>
        </div>
    );
});

export default NodeCard;
