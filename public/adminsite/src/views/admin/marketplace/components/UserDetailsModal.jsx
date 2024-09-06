// UserDetailsModal.jsx
import React from 'react';

const UserDetailsModal = ({ modalVisible, selectedUser, closeModal, handleOpenModal, formatInterests, API_ENDPOINTS }) => {
    if (!modalVisible || !selectedUser) return null;

    return (
        <div className="modaldetails" style={{ display: 'block' }}>
            <div className="modaldetails-content">
                <span className="close" onClick={closeModal}>&times;</span>
                <div className="modal-header">
                    <h2>User Details</h2>
                </div>
                <div className="modal-body">
                    <img
                        id="img01"
                        src={API_ENDPOINTS.Base_Url + selectedUser?.profilePic}
                        alt="Profile"
                        className="profile-pic"
                        onClick={() => handleOpenModal(
                            <img src={API_ENDPOINTS.Base_Url + selectedUser?.profilePic} alt="Example" />,
                            { top: '30%', left: '40%' }
                        )}
                    />

                    <div id="userDetails" className="user-details">
                        <p><strong>User ID:</strong> {selectedUser?.user_id}</p>
                        <p><strong>Generated Key:</strong> {selectedUser?.generatedKey}</p>
                        <p><strong>NIC:</strong> {selectedUser?.nic}</p>
                        <p><strong>Online:</strong> {selectedUser?.online ? 'Yes' : 'No'}</p>
                        <p><strong>Status:</strong> {selectedUser?.status}</p>
                        <p><strong>Created At:</strong> {new Date(selectedUser?.created_at).toLocaleString()}</p>
                        <p><strong>Updated At:</strong> {new Date(selectedUser?.updated_at).toLocaleString()}</p>
                        <p><strong>Gender:</strong> {selectedUser?.gender}</p>
                        <p><strong>Age:</strong> {selectedUser?.age}</p>
                        <p><strong>Birthday:</strong> {new Date(selectedUser?.birthday).toLocaleDateString()}</p>
                        <p><strong>Interests:</strong> {formatInterests(selectedUser?.interests)}</p>
                        <p><strong>Terms Agree:</strong> {selectedUser?.terms_agree ? 'Yes' : 'No'}</p>
                        <p><strong>First Name:</strong> {selectedUser?.firstName}</p>
                        <p><strong>Last Name:</strong> {selectedUser?.lastName}</p>
                        <p><strong>WhatsApp Number:</strong> {selectedUser?.whatsAppNumber}</p>
                        <p><strong>Job:</strong> {selectedUser?.job}</p>
                        <p><strong>Location:</strong> {selectedUser?.location}</p>
                        <p><strong>Marriage Status:</strong> {selectedUser?.marriageStatus}</p>
                        <p><strong>Height:</strong> {`${selectedUser?.heightFt}'${selectedUser?.heightIn}"`}</p>
                        <p><strong>Weight:</strong> {selectedUser?.weight}</p>
                        <p><strong>Personality Description:</strong> {selectedUser?.personalityDescription}</p>
                        <p><strong>Alcohol Consumption:</strong> {selectedUser?.alcoholConsumption}</p>
                        <p><strong>Looking For:</strong> {selectedUser?.lookingFor}</p>
                        <p><strong>Package Name:</strong> {selectedUser?.plan_name}</p>
                        <p><strong>Package Price:</strong> {selectedUser?.packagePrice}</p>
                        <p><strong>Package Duration:</strong> {`${selectedUser?.packageDurationMonth} month(s)`}</p>
                        <p><strong>Package Start Date:</strong> {new Date(selectedUser?.packageStartDate).toLocaleDateString()}</p>
                        <p><strong>Package End Date:</strong> {new Date(selectedUser?.packageEndDate).toLocaleDateString()}</p>
                        <p><strong>Payment Date:</strong> {new Date(selectedUser?.payment_date).toLocaleDateString()}</p>
                        <p><strong>Payment Status:</strong> {selectedUser?.payment_status === 1 ? 'Paid' : 'Unpaid'}</p>

                        <div className="nic-images">
                            {selectedUser?.nicFrontImage && (
                                <div>
                                    <p><strong>NIC Front Image:</strong></p>
                                    <img
                                        src={API_ENDPOINTS.Base_Url + selectedUser?.nicFrontImage}
                                        alt="NIC Front"
                                        className="nic-image"
                                        onClick={() => handleOpenModal(
                                            <img src={API_ENDPOINTS.Base_Url + selectedUser?.nicFrontImage} alt="Example" />,
                                            { top: '30%', left: '40%' }
                                        )}
                                    />
                                </div>
                            )}
                            {selectedUser?.nicBackImage && (
                                <div>
                                    <p><strong>NIC Back Image:</strong></p>
                                    <img
                                        src={API_ENDPOINTS.Base_Url + selectedUser?.nicBackImage}
                                        alt="NIC Back"
                                        className="nic-image"
                                    />
                                </div>
                            )}
                        </div>

                        {selectedUser?.otherImages && JSON.parse(selectedUser.otherImages).length > 0 && (
                            <div className="other-images-section">
                                <p><strong>Other Images:</strong></p>
                                <div id="modalOtherImages" className="other-images">
                                    {JSON.parse(selectedUser.otherImages).map((image, index) => (
                                        <img
                                            key={index}
                                            src={`${API_ENDPOINTS.Base_Url}${image}`}
                                            alt={`${selectedUser.name} other ${index + 1}`}  // Updated alt text
                                            className="other-image"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserDetailsModal;
