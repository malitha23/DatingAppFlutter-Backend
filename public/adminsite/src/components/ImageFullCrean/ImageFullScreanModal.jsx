import React from 'react';
import './ImageFullScreanModalCss.css'; // Import the CSS for styling

const ImageFullScreanModal = ({ isOpen, onClose, content }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <span className="close-button" onClick={onClose}>&times;</span>
                <div className="image-container">
                    {content}
                </div>
            </div>
        </div>
    );
};

export default ImageFullScreanModal;
