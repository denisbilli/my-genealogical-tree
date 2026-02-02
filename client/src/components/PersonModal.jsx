import React, { useState, useEffect } from 'react';

function PersonModal({ person, persons, onSave, onClose }) {
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
      setError(err.response?.data?.message || 'Failed to save person');
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{person ? 'Edit Person' : 'Add New Person'}</h2>
        {error && <div className="error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>First Name *</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Last Name *</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Gender *</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              required
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Birth Date</label>
            <input
              type="date"
              name="birthDate"
              value={formData.birthDate}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Birth Place</label>
            <input
              type="text"
              name="birthPlace"
              value={formData.birthPlace}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Death Date</label>
            <input
              type="date"
              name="deathDate"
              value={formData.deathDate}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Death Place</label>
            <input
              type="text"
              name="deathPlace"
              value={formData.deathPlace}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Photo</label>
            <input
              type="file"
              name="photo"
              accept="image/*"
              onChange={handleChange}
            />
            {photoPreview && (
              <img 
                src={photoPreview} 
                alt="Preview" 
                style={{ 
                  width: '100%', 
                  maxHeight: '200px', 
                  objectFit: 'cover', 
                  marginTop: '10px',
                  borderRadius: '5px'
                }} 
              />
            )}
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="4"
            />
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn">
              {person ? 'Update' : 'Add'} Person
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PersonModal;
