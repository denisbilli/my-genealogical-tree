import React, { useState, useEffect } from 'react';
import { X, UserPlus, Trash2, Users } from 'lucide-react';
import api from '../services/api';

/**
 * Modal per gestire una Union e i suoi figli.
 * Permette di aggiungere/rimuovere figli e specificare il tipo di parentela.
 */
const UnionModal = ({ union, onClose, onUpdate }) => {
    const [partners, setPartners] = useState([]);
    const [children, setChildren] = useState([]);
    const [potentialChildren, setPotentialChildren] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedChild, setSelectedChild] = useState('');
    const [selectedType, setSelectedType] = useState('bio');
    const [fullUnion, setFullUnion] = useState(null);

    useEffect(() => {
        loadUnionData();
    }, [union]);

    const loadUnionData = async () => {
        try {
            setLoading(true);
            
            // Prima carica la Union completa dal backend
            const unionRes = await api.get(`/tree/unions/all`);
            const fullUnionData = unionRes.data.find(u => u._id === union._id);
            
            if (!fullUnionData) {
                throw new Error('Union non trovata');
            }
            
            setFullUnion(fullUnionData);
            
            // Carica i partner
            const partnerPromises = fullUnionData.partnerIds.map(id => 
                api.get(`/persons/${id}`)
            );
            const partnerResponses = await Promise.all(partnerPromises);
            setPartners(partnerResponses.map(r => r.data));

            // Carica i figli attuali
            if (fullUnionData.childrenIds && fullUnionData.childrenIds.length > 0) {
                const childPromises = fullUnionData.childrenIds.map(id => 
                    api.get(`/persons/${id}`)
                );
                const childResponses = await Promise.all(childPromises);
                setChildren(childResponses.map(r => r.data));
            } else {
                setChildren([]);
            }

            // Carica i potenziali figli
            const potentialRes = await api.get(`/tree/union/${union._id}/potential-children`);
            setPotentialChildren(potentialRes.data);

        } catch (error) {
            console.error('Errore nel caricamento dati union:', error);
            alert('Errore nel caricamento: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleAddChild = async () => {
        if (!selectedChild) {
            alert('Seleziona un figlio da aggiungere');
            return;
        }

        try {
            await api.post(`/tree/union/${union._id}/child`, {
                childId: selectedChild,
                type: selectedType
            });
            
            setSelectedChild('');
            await loadUnionData();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Errore aggiunta figlio:', error);
            alert('Errore: ' + error.message);
        }
    };

    const handleRemoveChild = async (childId) => {
        if (!confirm('Rimuovere questo figlio dalla union?')) return;

        try {
            await api.delete(`/tree/union/${union._id}/child/${childId}`);
            await loadUnionData();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Errore rimozione figlio:', error);
            alert('Errore: ' + error.message);
        }
    };

    const handleUpdateChildType = async (childId, newType) => {
        try {
            await api.post(`/tree/union/${union._id}/child`, {
                childId: childId,
                type: newType
            });
            await loadUnionData();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Errore aggiornamento tipo figlio:', error);
            alert('Errore: ' + error.message);
        }
    };

    const getChildTypeKey = (child) => {
        // Usa fullUnion se disponibile, altrimenti union (ma fullUnion è preferibile per avere i dati aggiornati)
        const u = fullUnion || union;
        if (!child.parentRefs || !u || !u.partnerIds) return '';
        
        const types = u.partnerIds.map(partnerId => {
            const ref = child.parentRefs.find(r => 
                r.parentId === partnerId || r.parentId.toString() === partnerId.toString()
            );
            return ref ? ref.type : null;
        });

        const hasBothBio = types.every(t => t === 'bio');
        const hasStep = types.some(t => t === 'step');
        const hasAdoptive = types.some(t => t === 'adoptive');
        const hasFoster = types.some(t => t === 'foster');

        if (hasBothBio) return 'bio';
        if (hasAdoptive) return 'adoptive';
        if (hasFoster) return 'foster';
        if (hasStep) return 'step';
        return 'unknown';
    };

    const getParentalTypeLabel = (child) => {
        // Usa fullUnion se disponibile, altrimenti union (ma fullUnion è preferibile per avere i dati aggiornati)
        const u = fullUnion || union;
        if (!child.parentRefs || !u || !u.partnerIds) return 'Nessun tipo';
        
        const types = u.partnerIds.map(partnerId => {
            const ref = child.parentRefs.find(r => 
                r.parentId === partnerId || r.parentId.toString() === partnerId.toString()
            );
            return ref ? ref.type : null;
        });

        const hasBothBio = types.every(t => t === 'bio');
        const hasStep = types.some(t => t === 'step');
        const hasAdoptive = types.some(t => t === 'adoptive');
        const hasFoster = types.some(t => t === 'foster');

        if (hasBothBio) return '🔵 Biologico';
        if (hasAdoptive) return '🟢 Adottivo';
        if (hasFoster) return '🟣 Affido';
        if (hasStep) return '🟠 Acquisito';
        return 'Misto';
    };

    return (
        <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-pink-50 p-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="text-pink-600" size={24} />
                        <h2 className="text-xl font-semibold text-gray-800">
                            Gestione Union
                        </h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1 hover:bg-pink-100 rounded"
                    >
                        <X size={20} />
                    </button>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-500">
                        Caricamento...
                    </div>
                ) : (
                    <div className="p-6 space-y-6">
                        {/* Partner */}
                        <div>
                            <h3 className="font-semibold text-gray-700 mb-3">Partner:</h3>
                            <div className="flex gap-3">
                                {partners.length === 0 ? (
                                    <p className="text-gray-500 text-sm">Caricamento partner...</p>
                                ) : (
                                    partners.map(partner => (
                                        <div 
                                            key={partner._id}
                                            className="flex items-center gap-2 bg-pink-50 px-3 py-2 rounded-lg"
                                        >
                                            {partner.photo && (
                                                <img 
                                                    src={partner.photo} 
                                                    alt={partner.firstName}
                                                    className="w-8 h-8 rounded-full object-cover"
                                                />
                                            )}
                                            <span className="font-medium">{partner.firstName} {partner.lastName}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Figli attuali */}
                        <div>
                            <h3 className="font-semibold text-gray-700 mb-3">
                                Figli di questa Union ({children.length}):
                            </h3>
                            {children.length === 0 ? (
                                <p className="text-gray-500 text-sm">Nessun figlio assegnato</p>
                            ) : (
                                <div className="space-y-2">
                                    {children.map(child => (
                                        <div 
                                            key={child._id}
                                            className="flex items-center justify-between bg-blue-50 p-3 rounded-lg"
                                        >
                                            <div className="flex items-center gap-2">
                                                {child.photo && (
                                                    <img 
                                                        src={child.photo} 
                                                        alt={child.firstName}
                                                        className="w-8 h-8 rounded-full object-cover"
                                                    />
                                                )}
                                                <div>
                                                    <div className="font-medium">{child.firstName} {child.lastName}</div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-gray-600 w-24">
                                                            {getParentalTypeLabel(child)}
                                                        </span>
                                                        <select 
                                                            className="text-xs border rounded p-1"
                                                            value={getChildTypeKey(child)}
                                                            onChange={(e) => handleUpdateChildType(child._id, e.target.value)}
                                                        >
                                                            <option value="bio">Biologico</option>
                                                            <option value="step">Acquisito</option>
                                                            <option value="adoptive">Adottivo</option>
                                                            <option value="foster">Affido</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveChild(child._id)}
                                                className="p-1.5 hover:bg-red-100 rounded text-red-600"
                                                title="Rimuovi dalla union"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Aggiungi figlio */}
                        <div>
                            <h3 className="font-semibold text-gray-700 mb-3">
                                Aggiungi figlio:
                            </h3>
                            {potentialChildren.length === 0 ? (
                                <p className="text-gray-500 text-sm">
                                    Nessun figlio disponibile (tutti i figli dei partner sono già assegnati)
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    <select 
                                        value={selectedChild}
                                        onChange={e => setSelectedChild(e.target.value)}
                                        className="w-full p-2 border rounded"
                                    >
                                        <option value="">-- Seleziona un figlio --</option>
                                        {potentialChildren.map(child => (
                                            <option key={child._id} value={child._id}>
                                                {child.firstName} {child.lastName}
                                            </option>
                                        ))}
                                    </select>

                                    <div className="flex gap-2">
                                        <label className="flex items-center gap-2">
                                            <input 
                                                type="radio" 
                                                name="type"
                                                value="bio"
                                                checked={selectedType === 'bio'}
                                                onChange={e => setSelectedType(e.target.value)}
                                            />
                                            <span className="text-sm">Biologico</span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input 
                                                type="radio" 
                                                name="type"
                                                value="step"
                                                checked={selectedType === 'step'}
                                                onChange={e => setSelectedType(e.target.value)}
                                            />
                                            <span className="text-sm">Acquisito</span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input 
                                                type="radio" 
                                                name="type"
                                                value="adoptive"
                                                checked={selectedType === 'adoptive'}
                                                onChange={e => setSelectedType(e.target.value)}
                                            />
                                            <span className="text-sm">Adottivo</span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input 
                                                type="radio" 
                                                name="type"
                                                value="foster"
                                                checked={selectedType === 'foster'}
                                                onChange={e => setSelectedType(e.target.value)}
                                            />
                                            <span className="text-sm">Affido</span>
                                        </label>
                                    </div>

                                    <button
                                        onClick={handleAddChild}
                                        disabled={!selectedChild}
                                        className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
                                    >
                                        <UserPlus size={16} />
                                        Aggiungi figlio
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="bg-blue-50 p-3 rounded text-sm text-gray-700">
                            <strong>Nota:</strong> Qui puoi gestire quali figli appartengono a questa coppia.
                            I figli "acquisiti" (step) sono figli biologici di uno solo dei partner.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UnionModal;
