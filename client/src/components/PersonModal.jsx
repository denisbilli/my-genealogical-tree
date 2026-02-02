import React, { useState, useEffect } from 'react';

function PersonModal({ person, onSave, onClose }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: 'male',
    birthDate: '',
    birthPlace: '',
    deathDate: '',
    deathPlace: '',
    notes: '',
    photo: null
  });
  const [error, setError] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => {
    if (person) {
      setFormData({
        firstName: person.firstName || '',
        lastName: person.lastName || '',
        gender: person.gender || 'male',
        birthDate: person.birthDate ? person.birthDate.split('T')[0] : '',
        birthPlace: person.birthPlace || '',
        deathDate: person.deathDate ? person.deathDate.split('T')[0] : '',
        deathPlace: person.deathPlace || '',
        notes: person.notes || '',
        photo: null
      });
      if (person.photoUrl) {
        setPhotoPreview(person.photoUrl);
      }
    } else {
        // Reset for new person
        setFormData({
            firstName: '',
            lastName: '',
            gender: 'male',
            birthDate: '',
            birthPlace: '',
            deathDate: '',
            deathPlace: '',
            notes: '',
            photo: null
        });
        setPhotoPreview(null);
    }
  }, [person]);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'photo' && files && files[0]) {
      setFormData({ ...formData, photo: files[0] });
      setPhotoPreview(URL.createObjectURL(files[0]));
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await onSave(formData);
    } catch (err) {
      setError(err.message || 'Failed to save person');
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--primary)' }}>
            {person ? 'Modifica Persona' : 'Nuova Persona'}
        </h2>
        
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label>Nome *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Cognome *</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                />
              </div>
          </div>

          <div className="form-group">
            <label>Genere *</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              required
            >
              <option value="male">Maschio</option>
              <option value="female">Femmina</option>
              <option value="other">Altro</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label>Data di Nascita</label>
                <input
                  type="date"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleChange}
                />
              </div>

               <div className="form-group">
                <label>Luogo di Nascita</label>
                <input
                  type="text"
                  name="birthPlace"
                  value={formData.birthPlace}
                  onChange={handleChange}
                />
              </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label>Data di Morte</label>
                <input
                  type="date"
                  name="deathDate"
                  value={formData.deathDate}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Luogo di Morte</label>
                <input
                  type="text"
                  name="deathPlace"
                  value={formData.deathPlace}
                  onChange={handleChange}
                />
              </div>
          </div>

          <div className="form-group">
            <label>Foto</label>
            <input
              type="file"
              name="photo"
              accept="image/*"
              onChange={handleChange}
            />
            {photoPreview && (
              <div className="mt-2 flex justify-center">
                <img 
                  src={photoPreview} 
                  alt="Preview" 
                  style={{ 
                    width: '100px', 
                    height: '100px', 
                    objectFit: 'cover', 
                    borderRadius: '50%',
                    border: '2px solid var(--primary)'
                  }} 
                />
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Note</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
            />
          </div>

          <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-100">
            <button type="button" className="btn btn-danger" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="btn btn-primary">
              {person ? 'Salva Modifiche' : 'Crea Persona'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PersonModal;
