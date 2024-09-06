import React, { useState, useEffect, useRef } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Checkbox } from 'primereact/checkbox';
import { Dialog } from 'primereact/dialog';
import { useNavigate } from 'react-router-dom';
import 'primereact/resources/themes/saga-blue/theme.css'; // PrimeReact theme
import 'primereact/resources/primereact.min.css'; // PrimeReact styles
import 'primeicons/primeicons.css'; // PrimeIcons
import { API_ENDPOINTS } from '../../../config';
import { Toast } from 'primereact/toast';
import ImageFullScreanModal from '../../../components/ImageFullCrean/ImageFullScreanModal';
import './Marketplace.css';
import UserDetailsModal from './components/UserDetailsModal';


const Marketplace = () => {
  const [users, setUsers] = useState([]);
  const [usersAllUsers, setAllUsers] = useState([]);
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null); // For modal content
  const [modalVisible, setModalVisible] = useState(false); // For modal visibility
  const navigate = useNavigate();
  const statusOptions = ['approve', 'pending', 'reject'];
  const toast = useRef(null); // Reference for Toast
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [modalPosition, setModalPosition] = useState({ top: '50%', left: '50%' });
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [isSuccess, setIsSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tabledataloading, settabledataLoading] = useState(false);
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);


  useEffect(() => {
    // Fetch users from the API
    const fetchUsers = async () => {
      settabledataLoading(true);
      const token = localStorage.getItem('token'); // Get token from localStorage

      try {
        const response = await fetch(API_ENDPOINTS.NewUsersFetch, {
          method: 'GET', // HTTP method
          headers: {
            'Authorization': `Bearer ${token}`, // Authorization header with token
            'Content-Type': 'application/json', // Optional: specify content type
            'Accept': 'application/json' // Optional: specify acceptable response format
          }
        });

        if (!response.ok) {
          // Handle HTTP errors
          throw new Error('Network response was not ok');
        }

        const data = await response.json();

        // Map API response to the format used in the component
        const mappedUsers = data.map(user => ({
          id: user.user_id,
          generatedKey: user.generatedKey,
          name: `${user.firstName} ${user.lastName}`,
          nic: user.nic,
          payment: user.packagePrice, // Adjust according to your needs
          status: convertStatus(user.status)
        }));
        const allUsers = data.map(user => ({
          ...user // Add all user details here
        }));

        setUsers(mappedUsers);
        setAllUsers(allUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        settabledataLoading(false);
        // Set up interval to fetch users every 5 seconds
        const intervalId = setInterval(fetchUsersauto, 10000);

        // Clear interval on component unmount
        return () => clearInterval(intervalId);
      }
    };
    
    const fetchUsersauto = async () => {
      const token = localStorage.getItem('token'); // Get token from localStorage
  
      try {
        const response = await fetch(API_ENDPOINTS.NewUsersFetch, {
          method: 'GET', // HTTP method
          headers: {
            'Authorization': `Bearer ${token}`, // Authorization header with token
            'Content-Type': 'application/json', // Optional: specify content type
            'Accept': 'application/json' // Optional: specify acceptable response format
          }
        });
  
        if (!response.ok) {
          // Handle HTTP errors
          throw new Error('Network response was not ok');
        }
  
        const data = await response.json();
  
        // Map API response to the format used in the component
        const mappedUsers = data.map(user => ({
          id: user.user_id,
          generatedKey: user.generatedKey,
          name: `${user.firstName} ${user.lastName}`,
          nic: user.nic,
          payment: user.packagePrice, // Adjust according to your needs
          status: convertStatus(user.status)
        }));
        const allUsers = data.map(user => ({
          ...user // Add all user details here
        }));
  
        // Update state with new users only
        setUsers(prevUsers => {
          const existingUserIds = new Set(prevUsers.map(user => user.id));
          const newUsers = mappedUsers.filter(user => !existingUserIds.has(user.id));
          // Combine the existing users with new users
          const combinedUsers = [...prevUsers, ...newUsers];
          // Sort the combined list by user ID in descending order
          combinedUsers.sort((a, b) => b.id - a.id);
          return combinedUsers;
        });
  
  
        setAllUsers(allUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
      }
    };

    
    fetchUsers();

  }, []);


  const handleOpenModal = (content, position) => {
    setModalContent(content);
    setModalPosition(position);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const convertStatus = (status) => {
    switch (status) {
      case 0: return 'pending';
      case 1: return 'approve';
      case 2: return 'reject';
      default: return 'unknown';
    }
  };

  const onUpdate = (rowData) => {
    navigate('/update-user', { state: { user: rowData } });
  };

  const onDelete = async (rowData) => {
    const token = localStorage.getItem('token'); // Get token from localStorage
    try {
      const response = await fetch(`${API_ENDPOINTS.NewUsersDetete}${rowData.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      const result = await response.json(); // Parse the response JSON

      if (result.message === 'User deleted successfully') {


        console.log('User deleted successfully');

        // Show a success message popup using Toast
        toast.current.show({ severity: 'success', summary: 'Success', detail: 'User deleted successfully', life: 3000 });

        // Remove the user from the list
        const filteredUsers = users.filter(user => user.id !== rowData.id);
        setUsers(filteredUsers);

        // // Optionally set the message state to use in a message popup
        // setMessage('User status updated successfully');
      } else {
        throw new Error(result.message || 'Failed to deleted user');
      }

    } catch (error) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="flex space-x-2">
        <Button icon="pi pi-pencil" className="p-button-rounded p-button-success" onClick={() => onUpdate(rowData)} />
        <Button icon="pi pi-trash" className="p-button-rounded p-button-danger" onClick={() => onDelete(rowData)} />
        <Button icon="pi pi-info-circle" className="p-button-rounded p-button-info" onClick={() => showModal(rowData)} />
      </div>
    );
  };

  const statusBodyTemplate = (rowData) => {
    let statusColor = '';

    switch (rowData.status) {
      case 'approve':
        statusColor = 'green';
        break;
      case 'pending':
        statusColor = '#FFC000';
        break;
      case 'reject':
        statusColor = 'red';
        break;
      default:
        statusColor = 'gray';
        break;
    }

    const statusStyle = {
      backgroundColor: statusColor,
      padding: '4px',
      borderRadius: '4px',
    };

    return (
      <div style={statusStyle}>
        <Dropdown value={rowData.status} options={statusOptions} onChange={(e) => onStatusChange(e, rowData)} style={{ width: '100%' }} />
      </div>
    );
  };

  const onStatusChange = async (e, rowData) => {


    // Determine the status code based on e.value
    const statusCode = e.value === 'approve' ? 1 : e.value === 'reject' ? 2 : 0;

    // Fetch API call to update the user's status
    try {
      const token = localStorage.getItem('token'); // Get token from localStorage
      const response = await fetch(`${API_ENDPOINTS.NewUsersStatusChange}${rowData.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: statusCode })
      });

      const result = await response.json(); // Parse the response JSON

      if (result.message === 'User status updated successfully') {
        // Update the local state first
        const updatedUsers = users.map(user => {
          if (user.id === rowData.id) {
            user.status = e.value;
          }
          return user;
        });
        setUsers(updatedUsers);

        console.log('User status updated successfully');

        // Show a success message popup using Toast
        toast.current.show({ severity: 'success', summary: 'Success', detail: 'User status updated successfully', life: 3000 });

        // Remove the user from the list
        const filteredUsers = users.filter(user => user.id !== rowData.id);
        setUsers(filteredUsers);

        // // Optionally set the message state to use in a message popup
        // setMessage('User status updated successfully');
      } else {
        throw new Error(result.message || 'Failed to update user status');
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      // Show an error message if needed
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'Failed to update user status', life: 3000 });
    }
  };



  const onPageChange = (event) => {
    setFirst(event.first);
    setRows(event.rows);
  };

  const filteredUsers = users.filter(user =>
    user.id.toString().includes(searchTerm) ||
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.nic.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const showModal = (user) => {
    // Find the user in the usersAllUsers array based on the ID
    const fullUserDetails = usersAllUsers.find(fullUser => fullUser.user_id === user.id);

    if (fullUserDetails) {
      setSelectedUser(fullUserDetails);
      setModalVisible(true);
    } else {
      console.error('User details not found for the selected user.');
    }
  };


  const closeModal = () => {
    setModalVisible(false);
  };

  const formatInterests = (interests) => {
    console.log('Interests value:', interests); // Log the interests value

    if (!interests) return <div>No interests available</div>;

    try {
      // Parse the JSON string if it's not already an array
      let interestIds;
      if (typeof interests === 'string') {
        interestIds = JSON.parse(interests);
      } else {
        interestIds = interests;
      }

      console.log('Parsed Interests:', interestIds); // Log parsed interests

      // Ensure that the parsed value is an array
      if (!Array.isArray(interestIds)) {
        throw new Error('Parsed interests is not an array');
      }

      // Convert to numbers if needed
      const interestNumbers = interestIds.map(id => Number(id));

      console.log('Interest Numbers:', interestNumbers); // Log numbers


      const interestsData = [
        { id: '1', name: 'Reading', icon: 'pi pi-book' }, // Book icon
        { id: '2', name: 'Photography', icon: 'pi pi-camera' }, // Camera icon
        { id: '3', name: 'Gaming', icon: 'pi pi-discord' }, // Gaming icon
        { id: '4', name: 'Music', icon: 'pi pi-headphones' }, // Music icon
        { id: '5', name: 'Travel', icon: 'pi pi-airplane' }, // Airplane icon
        { id: '6', name: 'Painting', icon: 'pi pi-paint' }, // Paint icon
        { id: '7', name: 'Politics', icon: 'pi pi-briefcase' }, // Briefcase icon (politics related)
        { id: '8', name: 'Charity', icon: 'pi pi-heart' }, // Heart icon
        { id: '9', name: 'Cooking', icon: 'pi pi-cooking' }, // Cooking icon
        { id: '10', name: 'Pets', icon: 'pi pi-pet' }, // Pet icon
        { id: '11', name: 'Sports', icon: 'pi pi-soccer' }, // Soccer icon
        { id: '12', name: 'Fashion', icon: 'pi pi-style' }, // Style icon
      ];

      return interestIds.map(id => {
        const interest = interestsData.find(item => item.id === id);
        return interest ? (
          <div key={id} className="interest-item">
            <i className={interest.icon}></i> {interest.name}
          </div>
        ) : (
          <div key={id} className="interest-item">
            <i className="pi pi-question-circle"></i> Unknown interest
          </div>
        );
      });
    } catch (error) {
      console.error('Error processing interests:', error);
      return <div>Error loading interests: {error.message}</div>;
    }
  };


  // Function to handle checkbox change
  const onCheckboxChange = (e, user) => {
    let updatedSelectedUsers = [...selectedUsers];
    if (e.checked) {
      updatedSelectedUsers = [...updatedSelectedUsers, user];
    } else {
      updatedSelectedUsers = updatedSelectedUsers.filter(u => u.id !== user.id);
    }
    setSelectedUsers(updatedSelectedUsers);

    // Open the bottom sheet if there are selected users
    if (updatedSelectedUsers.length > 0) {
      setBottomSheetVisible(true);
    } else {
      setBottomSheetVisible(false);
    }

  };

  // Checkbox column template
  const checkboxBodyTemplate = (rowData) => {
    return (
      <Checkbox
        checked={selectedUsers.some(user => user.id === rowData.id)}
        onChange={(e) => onCheckboxChange(e, rowData)}
        className="custom-checkbox"
      />
    );
  };

  // Conditional row styling based on selection
  const rowClassName = (rowData) => {
    return selectedUsers.some(user => user.id === rowData.id) ? 'selected-row' : '';
  };

  const onSelectAllChange = (e) => {
    setSelectAll(e.checked);
    if (e.checked) {
      setDialogVisible(true); // Show the dialog when checkbox state changes
      setIsSuccess(null);
    } else {
      setIsSuccess(null);
      setSelectedUsers([]);
    }

  };

  const handleDialogConfirm = (isSuccess) => {
    setIsSuccess(isSuccess);
    const filtered = filteredUsers.filter(user =>
      isSuccess ? user.generatedKey !== null : user.generatedKey == null
    );
    setSelectedUsers(filtered); // Update selected users based on success
    // setDialogVisible(false); // Close the dialog
  };

  const dialogFooter = isSuccess === null ? (
    <div>
      <Button
        label="Successful Users"
        icon="pi pi-check"
        className="p-button-success"
        onClick={() => handleDialogConfirm(true)}
      />
      <Button
        label="Not Successful Users"
        icon="pi pi-times"
        className="p-button-danger"
        onClick={() => handleDialogConfirm(false)}
      />
    </div>
  ) : (
    <div>
      <Button
        label={loading ? 'Waiting...' : `${isSuccess ? 'Approve' : 'Reject'} ${isSuccess ? 'Successful' : 'Not Successful'} Users (${selectedUsers.length})`}
        icon={isSuccess ? "pi pi-check" : "pi pi-times"}
        className={isSuccess ? "p-button-success" : "p-button-danger"}
        onClick={() => handleDialogConfirmresponse(isSuccess)}
        disabled={loading} // Disable button when loading
      />
    </div>
  );

  const handleDialogConfirmresponse = async (isSuccess) => {
    const status = isSuccess ? 1 : 2;
    const updatedUsers = selectedUsers.map(user => ({
      id: user.id,
      status: status
    }));

    setLoading(true); // Set loading to true when the process starts

    try {
      // Post selected users with status to the backend
      const token = localStorage.getItem('token'); // Get token from localStorage
      const response = await fetch(`${API_ENDPOINTS.NewUsersBulkStatusChange}`, {
        method: 'POST', // Use POST method for bulk updates
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ users: updatedUsers })
      });

      const result = await response.json(); // Parse the response JSON

      if (response.ok && result.message === 'User statuses updated successfully') {
        // Remove updated users from filteredUsers
        const updatedFilteredUsers = filteredUsers.filter(user =>
          !selectedUsers.some(selectedUser => selectedUser.id === user.id)
        );

        // Set the updated filtered users to the state
        setUsers(updatedFilteredUsers);

        // Show a success message popup using Toast
        toast.current.show({ severity: 'success', summary: 'Success', detail: 'User status updated successfully', life: 3000 });

      } else {
        throw new Error(result.message || 'Failed to update user status');
      }
    } catch (error) {
      console.error("Error updating users:", error);
      setLoading(false); // Reset loading state
      setDialogVisible(false); // Close dialog
      setSelectAll(false);
    } finally {
      setLoading(false); // Reset loading state
      setDialogVisible(false); // Close dialog
      setSelectAll(false);
    }
  };

  const handleApproveorreject = async (isSuccess) => {
    const status = isSuccess ? 1 : 2;
    const updatedUsers = selectedUsers.map(user => ({
      id: user.id,
      status: status
    }));

    try {
      // Post selected users with status to the backend
      const token = localStorage.getItem('token'); // Get token from localStorage
      const response = await fetch(`${API_ENDPOINTS.NewUsersBulkStatusChange}`, {
        method: 'POST', // Use POST method for bulk updates
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ users: updatedUsers })
      });

      const result = await response.json(); // Parse the response JSON

      if (result.message === 'User statuses updated successfully') {
        // Show a success message popup using Toast
        toast.current.show({ severity: 'success', summary: 'Success', detail: 'User status updated successfully', life: 3000 });

        // Remove the processed users from the list
        const filteredUsers = users.filter(user => !selectedUsers.some(selectedUser => selectedUser.id === user.id));
        setUsers(filteredUsers);

        // Optionally, clear selected users
        setSelectedUsers([]);
      } else {
        throw new Error(result.message || 'Failed to update user status');
      }
    } catch (error) {
      console.error("Error updating users:", error);
      alert("Error updating users");
    }

    // Close bottom sheet
    setBottomSheetVisible(false);
  };


  return (
    <div className="container mx-auto mt-5 mb-3">
      <Toast ref={toast} />
      <Dialog
        header="Confirm Registration"
        visible={dialogVisible}
        onHide={() => setDialogVisible(false)}
        footer={dialogFooter}
        className="custom-dialog"
      >
        <p>
          {isSuccess === null
            ? 'Do you want to register successful users or not successful users?'
            : `You have selected ${selectedUsers.length} users. Approve ${isSuccess ? 'Success' : 'Not Success'} users?`
          }
        </p>
      </Dialog>

      <div className={`bottom-sheet ${bottomSheetVisible ? 'visible' : ''}`}>

        <div className="bottom-sheet-body">
          <p>Do you want to approve or reject the selected users?</p>
          <div className="bottom-sheet-footer">
            <Button
              label={`Approve Users (${selectedUsers.length})`}
              icon="pi pi-check"
              style={{ backgroundColor: '#02db09', color: '#fff', padding: '8px', borderRadius: '10px' }} // Green background
              className="p-button-success"
              onClick={() => handleApproveorreject(true)}
            />
            <Button
              label={`Reject Users (${selectedUsers.length})`}
              icon="pi pi-times"
              style={{ backgroundColor: '#f44336', color: '#fff', padding: '8px', borderRadius: '10px' }} // Red background
              className="p-button-danger"
              onClick={() => handleApproveorreject(false)}
            />

          </div>
        </div>

      </div>

      <ImageFullScreanModal isOpen={isModalOpen} onClose={handleCloseModal} content={modalContent} position={modalPosition} />
      <div className="mb-4 flex">
        <h1 className='mr-5 bg-blueSecondary text-white text-md p-2'>Search</h1>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by User ID, Name, or NIC"
          className="p-inputtext p-component shadow-lg w-full flex-grow p-2"
        />
      </div>

      <div className="data-table-container">
        {tabledataloading ? (
          <div className="loading-overlay">
            <div className="custom-spinner"></div>
          </div>
        ) : (
          <DataTable
            value={filteredUsers}
            paginator
            rows={rows}
            first={first}
            onPage={onPageChange}
            rowClassName={rowClassName}
            className="w-full"
          >
            <Column body={checkboxBodyTemplate} header={
              <div className="p-d-flex p-ai-center">
                <Checkbox
                  checked={selectAll}
                  onChange={onSelectAllChange}
                  className="custom-checkbox"
                />
                <span className="p-ml-2"> All</span>
              </div>
            } />
            <Column field="id" header="User Id" />
            <Column field="generatedKey" header="Generated Key" sortable />
            <Column field="name" header="Name" />
            <Column field="nic" header="NIC Number" />
            <Column field="payment" header="Payment" />
            <Column header="Status" body={statusBodyTemplate} />
            <Column header="Actions" body={actionBodyTemplate} />
          </DataTable>
        )}
      </div>
      <UserDetailsModal
        modalVisible={modalVisible}
        selectedUser={selectedUser}
        closeModal={closeModal}
        handleOpenModal={handleOpenModal}
        formatInterests={formatInterests}
        API_ENDPOINTS={API_ENDPOINTS}
      />
    </div>
  );
};



export default Marketplace;
