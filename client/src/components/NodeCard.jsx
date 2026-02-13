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
                    border: '3px solid var(--card-bg)',
                    zIndex: 5,
                    boxShadow: '0 2px 8px var(--shadow-color)',
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
                zIndex: isHighlighted ? 10 : 1
            }}
        >
            {/* Collapse Buttons */}
            {/* Top - Hide Ancestors - Moved to Right to avoid overlap with + button */}
            <button 
                onClick={(e) => { e.stopPropagation(); onToggleCollapse(node._id, 'up'); }}
                style={{
                  position: 'absolute',
                  top: '-0.75rem',
                  right: '2rem',
                  width: '1.5rem',
                  height: '1.5rem',
                  borderRadius: '50%',
                  border: '1px solid var(--border-color)',
                  backgroundColor: node.isCollapsedAncestors ? 'var(--bg-secondary)' : 'var(--card-bg)',
                  boxShadow: '0 1px 3px 0 var(--shadow-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  zIndex: 20
                }}
                title={node.isCollapsedAncestors ? "Mostra antenati" : "Nascondi antenati"}
            >
                <ChevronUp size={14} color={node.isCollapsedAncestors ? "var(--primary)" : "var(--text-secondary)"} style={{ transform: node.isCollapsedAncestors ? 'rotate(180deg)' : 'none' }} />
            </button>

            {/* Bottom - Hide Descendants - Moved to Right to avoid overlap with + button */}
            <button 
                onClick={(e) => { e.stopPropagation(); onToggleCollapse(node._id, 'down'); }}
                style={{
                  position: 'absolute',
                  bottom: '-0.75rem',
                  right: '2rem',
                  width: '1.5rem',
                  height: '1.5rem',
                  borderRadius: '50%',
                  border: '1px solid var(--border-color)',
                  backgroundColor: node.isCollapsedDescendants ? 'var(--bg-secondary)' : 'var(--card-bg)',
                  boxShadow: '0 1px 3px 0 var(--shadow-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  zIndex: 20
                }}
                title={node.isCollapsedDescendants ? "Mostra discendenti" : "Nascondi discendenti"}
            >
                <ChevronDown size={14} color={node.isCollapsedDescendants ? "var(--primary)" : "var(--text-secondary)"} style={{ transform: node.isCollapsedDescendants ? 'rotate(180deg)' : 'none' }} />
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
                    <h3 style={{ fontWeight: 'bold', margin: 0, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-main)' }}>
                        {node.firstName} <span style={{ textTransform: 'uppercase', fontSize: '0.8rem', opacity: 0.7 }}>{node.lastName}</span>
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                         {yearRange}
                    </p>
                </div>
                <div className="flex flex-col gap-1">
                     <button onClick={() => onEdit(node)} style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }} title="Modifica">
                        <User size={14} />
                    </button>
                    <button onClick={() => onDelete(node._id)} style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }} title="Elimina">
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
