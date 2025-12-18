import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaTrash, FaPlus } from 'react-icons/fa';

export default function AssignedPrograms({ isDarkMode }) {
  const [programs, setPrograms] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedMentor, setSelectedMentor] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Fetch all data on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setErrorMessage('');
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      // Fetch courses (no auth expected)
      const programsRes = await axios.get('http://localhost:5000/api/courses');
      setPrograms(programsRes.data || []);
    } catch (err) {
      console.error('Error fetching courses:', err);
      setErrorMessage('Failed to load programs (/api/courses). Is the backend running?');
      setLoading(false);
      return;
    }

    try {
      // Fetch mentors (protected)
      const mentorsRes = await axios.get('http://localhost:5000/api/mentors', { headers });
      const mentorsPayload = mentorsRes.data;
      if (Array.isArray(mentorsPayload)) setMentors(mentorsPayload);
      else if (mentorsPayload && Array.isArray(mentorsPayload.data)) setMentors(mentorsPayload.data);
      else if (mentorsPayload && Array.isArray(mentorsPayload.mentors)) setMentors(mentorsPayload.mentors);
      else setMentors([]);
    } catch (err) {
      console.error('Error fetching mentors:', err);
      setErrorMessage('Failed to load mentors (/api/mentors). You may need to be logged in (admin token).');
      setLoading(false);
      return;
    }

    try {
      // Fetch assigned programs
      const assignmentsRes = await axios.get('http://localhost:5000/api/assigned-programs', { headers });
      const aPayload = assignmentsRes.data;
      if (Array.isArray(aPayload)) setAssignments(aPayload);
      else if (aPayload && Array.isArray(aPayload.data)) setAssignments(aPayload.data);
      else if (aPayload && Array.isArray(aPayload.assignments)) setAssignments(aPayload.assignments);
      else setAssignments([]);
    } catch (err) {
      console.error('Error fetching assigned programs:', err);
      setErrorMessage('Failed to load assigned programs (/api/assigned-programs).');
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  const handleAssignProgram = async () => {
    if (!selectedProgram || !selectedMentor) {
      alert('Please select both a program and a mentor');
      return;
    }

    try {
      setAssignLoading(true);
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await axios.post('http://localhost:5000/api/assigned-programs', {
        course_id: selectedProgram,
        mentor_id: selectedMentor
      }, { headers });

      if (response.data.success) {
        alert('Program assigned successfully!');
        setAssignments([response.data.data, ...assignments]);
        setSelectedProgram('');
        setSelectedMentor('');
        // Best-effort notifications: admin + mentor
        try {
          const programObj = programs.find(p => String(p.id) === String(selectedProgram));
          const mentorObj = mentors.find(m => String(m.id) === String(selectedMentor));
          const programTitle = programObj?.title || programObj?.name || `ID ${selectedProgram}`;
          const mentorName = mentorObj?.full_name || mentorObj?.name || `ID ${selectedMentor}`;
          const tokenForNotif = localStorage.getItem('token');
          const notifHeaders = tokenForNotif ? { Authorization: `Bearer ${tokenForNotif}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };

          // Admin notification
          await axios.post('http://localhost:5000/api/notifications', {
            role: 'admin',
            type: 'assignment',
            title: 'Program assigned',
            message: `${programTitle} was assigned to ${mentorName}.`,
            metadata: { entity: 'assigned-program', programId: selectedProgram, mentorId: selectedMentor }
          }, { headers: notifHeaders });

          // Mentor notification
          await axios.post('http://localhost:5000/api/notifications', {
            role: 'mentor',
            recipientId: selectedMentor,
            type: 'assignment',
            title: 'New program assigned to you',
            message: `You have been assigned the program: ${programTitle}.`,
            metadata: { entity: 'assigned-program', programId: selectedProgram }
          }, { headers: notifHeaders });
        } catch (notifErr) {
          console.error('Failed to create assignment notifications', notifErr);
        }
      }
    } catch (err) {
      console.error('Error assigning program:', err);
      alert(err.response?.data?.message || 'Failed to assign program');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleRemoveAssignment = async (id) => {
    if (!window.confirm('Are you sure you want to remove this assignment?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(`http://localhost:5000/api/assigned-programs/${id}`, { headers });
      setAssignments(assignments.filter(a => a.id !== id));
      alert('Assignment removed successfully!');
      // Best-effort: notify admin and mentor about removal
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
        const removed = assignments.find(a => a.id === id) || null;
        const programName = removed?.program_name || removed?.program_title || `ID ${removed?.course_id || ''}`;
        const mentorId = removed?.mentor_id || removed?.mentorId || null;

        // Admin notification
        await axios.post('http://localhost:5000/api/notifications', {
          role: 'admin',
          type: 'assignment-removal',
          title: 'Program assignment removed',
          message: `${programName} assignment was removed.`,
          metadata: { entity: 'assigned-program', id }
        }, { headers });

        // Mentor notification if mentor id available
        if (mentorId) {
          await axios.post('http://localhost:5000/api/notifications', {
            role: 'mentor',
            recipientId: mentorId,
            type: 'assignment-removal',
            title: 'Program assignment removed',
            message: `The program ${programName} assigned to you was removed.`,
            metadata: { entity: 'assigned-program', id }
          }, { headers });
        }
      } catch (notifErr) {
        console.error('Failed to create assignment removal notifications', notifErr);
      }
    } catch (err) {
      console.error('Error removing assignment:', err);
      alert('Failed to remove assignment');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className={`${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} min-h-screen p-6 flex items-center justify-center`}>
        <p className="text-xl">Loading...</p>
      </div>
    );
  }

  // Show specific error message if any endpoint failed
  if (errorMessage) {
    return (
      <div className={`${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} min-h-screen p-6`}>
        <div className="max-w-3xl mx-auto">
          <div className="p-6 rounded-md bg-red-50 text-red-800 border border-red-200">
            <h3 className="font-semibold mb-2">Failed to load details</h3>
            <p className="text-sm">{errorMessage}</p>
            <p className="mt-3 text-sm">Open browser devtools → Network to see the failing request.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className={`${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} min-h-screen p-6`}>
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold mb-2">Assign Programs to Mentors</h1>
        <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Use the form below to assign training programs to mentors.
        </p>
      </header>

      {/* Assign Programs Section */}
      <section className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-6 mb-8`}>
        

        <div className="flex flex-col md:flex-row gap-4 mb-4">
          {/* Program Dropdown */}
          <div className="flex-1">
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Program Name
            </label>
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className={`w-full px-4 py-2 rounded-md border ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-gray-50 border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <option value="">Select a program</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.title}
                </option>
              ))}
            </select>
          </div>

          {/* Mentor Dropdown */}
          <div className="flex-1">
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Mentor Name
            </label>
            <select
              value={selectedMentor}
              onChange={(e) => setSelectedMentor(e.target.value)}
              className={`w-full px-4 py-2 rounded-md border ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-gray-50 border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <option value="">Select a mentor</option>
              {mentors.map((mentor) => (
                <option key={mentor.id} value={mentor.id}>
                  {mentor.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Assign Button */}
        <button
          onClick={handleAssignProgram}
          disabled={assignLoading || !selectedProgram || !selectedMentor}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
        >
          <FaPlus /> {assignLoading ? 'Assigning...' : 'Assign Program'}
        </button>
      </section>

      {/* Assignments Table */}
      <section className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">Program</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Mentor</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Assigned On</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                    No ssignments yet. Assign a program to a mentor above.
                  </td>
                </tr>
              ) : (
                assignments.map((assignment) => (
                  <tr
                    key={assignment.id}
                    className={`border-t ${
                      isDarkMode ? 'border-gray-700 hover:bg-gray-750' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-6 py-4">{assignment.program_name}</td>
                    <td className="px-6 py-4">{assignment.mentor_name}</td>
                    <td className="px-6 py-4">{formatDate(assignment.assigned_on)}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleRemoveAssignment(assignment.id)}
                        className="flex items-center gap-1 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition"
                      >
                        <FaTrash className="w-3 h-3" /> Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}