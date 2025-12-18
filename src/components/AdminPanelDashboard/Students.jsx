// src/components/AdminPanelDashboard/Students.jsx

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Search,
  Loader2,
  Users,
  Eye,
  X,
  Award,
  BookOpen,
  Calendar,
  Github,
  Linkedin,
  Mail,
  Phone,
} from "lucide-react";

const API_BASE_URL = "http://localhost:5000/api/students";

const Students = ({ isDarkMode }) => {
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);
  const [isDeactivating, setIsDeactivating] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchAllStudents = useCallback(async () => {
    try {
      setLoading(true);
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(API_BASE_URL, { headers });
      const data = await res.json();
      if (data.success) setStudents(data.data || []);
      else setStudents([]);
    } catch (err) {
      console.error("Error fetching students:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllStudents();
  }, [fetchAllStudents]);

  const handleDelete = async (id) => {
    const studentToDelete = students.find((s) => s.id === id);
    const studentName = studentToDelete?.full_name || `ID ${id}`;
    if (!window.confirm(`Are you sure you want to delete ${studentName}?`)) return;

    try {
      setIsDeleting(id);
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers = token
        ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
        : { "Content-Type": "application/json" };
      const res = await fetch(`${API_BASE_URL}/${id}`, { method: "DELETE", headers });
      const result = await res.json();
      if (result.success) {
        setStudents((current) => current.filter((s) => s.id !== id));
        // Notify admins about this deletion
        try {
          await fetch("http://localhost:5000/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              role: "admin",
              type: "deletion",
              title: "Student deleted",
              message: `${studentName} was deleted (id: ${id}).`,
              metadata: { entity: "student", id },
            }),
          });
        } catch (notifErr) {
          console.error("Failed to create notification:", notifErr);
        }
      } else {
        alert(result.message || "Failed to delete student");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting student");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleDeactivate = async (id, currentStatus) => {
    const studentToUpdate = students.find((s) => s.id === id);
    const newStatus = currentStatus === "Active" ? "Inactive" : "Active";
    const studentName = studentToUpdate?.full_name || `ID ${id}`;

    if (!window.confirm(`Are you sure you want to change the status of ${studentName} to "${newStatus}"?`))
      return;

    try {
      setIsDeactivating(id);
      await new Promise((resolve) => setTimeout(resolve, 800));
      setStudents((current) =>
        current.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
      );
      alert(`Successfully set ${studentName} status to ${newStatus}.`);

      // Notify admins about status change
      try {
        await fetch("http://localhost:5000/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "admin",
            type: "status-change",
            title: "Student status updated",
            message: `${studentName} status changed to ${newStatus} (id: ${id}).`,
            metadata: { entity: "student", id, status: newStatus },
          }),
        });
      } catch (notifErr) {
        console.error("Failed to create notification:", notifErr);
      }
    } catch (err) {
      console.error("Error updating status:", err);
      alert(`Failed to change student status to ${newStatus}.`);
    } finally {
      setIsDeactivating(null);
    }
  };

  // Fetch student details + interview count (robust)
  const fetchStudentDetails = async (studentId) => {
    try {
      setLoadingDetails(true);
      setSelectedStudent(studentId);
      setStudentDetails(null);

      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // 1) Fetch details
      const res = await fetch(`${API_BASE_URL}/${studentId}/details`, { headers });
      const data = await res.json();
      if (!data.success) {
        alert("Failed to load student details");
        setSelectedStudent(null);
        setLoadingDetails(false);
        return;
      }

      const details = data.data;

      // 2) Attempt to fetch interviews for this student to compute interview count
      // Try multiple likely endpoints; fallback to 0
      let interviewsCount = 0;
      try {
        // Common query param style
        let ivRes = await fetch(`http://localhost:5000/api/interviews?studentId=${studentId}`, { headers });
        if (!ivRes.ok) {
          // try another pattern
          ivRes = await fetch(`http://localhost:5000/api/interviews/student/${studentId}`, { headers });
        }
        if (ivRes.ok) {
          const ivData = await ivRes.json();
          // ivData might be an object { success, data } or array
          if (Array.isArray(ivData)) interviewsCount = ivData.length;
          else if (ivData?.success && Array.isArray(ivData.data)) interviewsCount = ivData.data.length;
          else if (Array.isArray(ivData?.data)) interviewsCount = ivData.data.length;
        } else {
          // no interviews endpoint or none scheduled -> interviewsCount stays 0
          interviewsCount = 0;
        }
      } catch (ivErr) {
        console.warn("Interview fetch failed or endpoint not available:", ivErr);
        interviewsCount = 0;
      }

      // Attach interviewsCount into details.stats (safe merge)
      const mergedDetails = {
        ...details,
        stats: {
          ...details.stats,
          interviewsCount: typeof interviewsCount === "number" ? interviewsCount : 0,
        },
      };

      setStudentDetails(mergedDetails);
    } catch (err) {
      console.error("Error fetching student details:", err);
      alert("Error loading student details");
      setSelectedStudent(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeModal = () => {
    setSelectedStudent(null);
    setStudentDetails(null);
  };

  // ✅ FIXED: Search functionality using correct endpoint
  useEffect(() => {
    const timeout = setTimeout(async () => {
      const trimmedSearch = searchTerm.trim();

      // If search is empty, fetch all students
      if (!trimmedSearch) {
        fetchAllStudents();
        return;
      }

      try {
        setSearching(true);
        // ✅ CHANGED: Use /search?q= instead of /search/:name
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(
          `${API_BASE_URL}/search?q=${encodeURIComponent(trimmedSearch)}`,
          { headers }
        );
        const data = await res.json();

        if (data.success) {
          setStudents(data.data || []);
        } else {
          setStudents([]);
        }
      } catch (err) {
        console.error("Search error:", err);
        setStudents([]);
      } finally {
        setSearching(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeout);
  }, [searchTerm, fetchAllStudents]);

  return (
    <div
      className={`min-h-screen p-4 sm:p-8 font-inter transition-colors duration-500 ${
        isDarkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="text-4xl font-extrabold flex items-center gap-3">
          <Users className="w-8 h-8 text-indigo-500" />
          Manage Students
        </div>

        {/* Search Bar */}
        <div
          className={`p-4 shadow-md rounded-lg border transition-colors duration-300 ${
            isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"
          }`}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-400 outline-none ${
                isDarkMode
                  ? "bg-gray-700 text-gray-100 border-gray-600 placeholder-gray-400"
                  : "bg-white text-gray-900 border-gray-300 placeholder-gray-400"
              }`}
            />
            {searching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Students Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className={`rounded-lg shadow-md p-6 animate-pulse ${
                  isDarkMode ? "bg-gray-800" : "bg-white"
                }`}
              ></div>
            ))
          ) : students.length > 0 ? (
            students.map((student) => {
              const currentStatus = student.status || "Active";
              const isCurrentlyActive = currentStatus === "Active";

              return (
                <motion.div
                  key={student.id}
                  layout
                  className={`rounded-lg shadow-md hover:shadow-lg p-6 transition-all ${
                    isDarkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"
                  }`}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 flex-shrink-0">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Flexible row that wraps when name is too long */}
                      <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                        <h3 className="text-xl font-bold break-words flex-shrink min-w-0">
                          {student.full_name}
                        </h3>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded-full whitespace-nowrap ${
                              isCurrentlyActive ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {currentStatus}
                          </span>

                          <button
                            onClick={() => fetchStudentDetails(student.id)}
                            className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors text-blue-600 dark:text-blue-400"
                            title="View Details"
                            aria-label={`View details for ${student.full_name}`}
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-sm line-clamp-2">
                        {Array.isArray(student.domains_of_interest)
                          ? student.domains_of_interest.join(", ")
                          : student.domains_of_interest}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 gap-3">
                    <button
                      onClick={() => handleDeactivate(student.id, currentStatus)}
                      disabled={isDeactivating === student.id}
                      className={`inline-flex items-center px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                        isDeactivating === student.id
                          ? "bg-blue-300 text-blue-800 cursor-not-allowed"
                          : "bg-blue-500 text-white hover:bg-blue-600"
                      }`}
                    >
                      {isDeactivating === student.id ? "Updating..." : isCurrentlyActive ? "Deactivate" : "Activate"}
                    </button>

                    <button
                      onClick={() => handleDelete(student.id)}
                      disabled={isDeleting === student.id}
                      className={`inline-flex items-center px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                        isDeleting === student.id ? "bg-red-300 text-red-800 cursor-not-allowed" : "bg-red-500 text-white hover:bg-red-600"
                      }`}
                    >
                      {isDeleting === student.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500">{searchTerm ? "No students found matching your search." : "No students found."}</p>
            </div>
          )}
        </div>
      </div>

      {/* Student Details Modal */}
      <AnimatePresence>
        {selectedStudent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl ${
                isDarkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"
              }`}
            >
              {/* Modal Header */}
              <div
                className={`sticky top-0 z-10 p-6 border-b flex justify-between items-center ${
                  isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                }`}
              >
                <h2 className="text-2xl font-bold">Student Details</h2>
                <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                {loadingDetails ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
                ) : studentDetails ? (
                  <div className="space-y-6">
                    {/* Profile Section */}
                    <div className={`p-6 rounded-lg ${isDarkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Profile Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Full Name</p>
                          <p className="font-semibold">{studentDetails.profile.full_name || studentDetails.profile.profile_full_name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                          <p className="font-semibold flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            {studentDetails.profile.email}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                          <p className="font-semibold flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            {studentDetails.profile.phone || studentDetails.profile.contact_number}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Profile Status</p>
                          <p className={`font-semibold ${studentDetails.profile.profile_completed ? "text-green-500" : "text-yellow-500"}`}>
                            {studentDetails.profile.profile_completed ? "Completed" : "Incomplete"}
                          </p>
                        </div>
                        {studentDetails.profile.linkedin_url && (
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">LinkedIn</p>
                            <a href={studentDetails.profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-500 hover:underline flex items-center gap-2">
                              <Linkedin className="w-4 h-4" /> View Profile
                            </a>
                          </div>
                        )}
                        {studentDetails.profile.github_url && (
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">GitHub</p>
                            <a href={studentDetails.profile.github_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-500 hover:underline flex items-center gap-2">
                              <Github className="w-4 h-4" /> View Profile
                            </a>
                          </div>
                        )}
                      </div>

                      {studentDetails.profile.why_hire_me && (
                        <div className="mt-4">
                          <p className="text-sm text-gray-500 dark:text-gray-400">Why Hire Me</p>
                          <p className="mt-1">{studentDetails.profile.why_hire_me}</p>
                        </div>
                      )}

                      {studentDetails.profile.domains_of_interest && (
                        <div className="mt-4">
                          <p className="text-sm text-gray-500 dark:text-gray-400">Domains of Interest</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {(Array.isArray(studentDetails.profile.domains_of_interest)
                              ? studentDetails.profile.domains_of_interest
                              : [studentDetails.profile.domains_of_interest]
                            ).map((domain, idx) => (
                              <span key={idx} className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                                {domain}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Stats Section */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className={`p-4 rounded-lg text-center ${isDarkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                        <p className="text-2xl font-bold text-blue-500">{studentDetails.stats.totalProjects}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Projects</p>
                      </div>
                      <div className={`p-4 rounded-lg text-center ${isDarkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                        <p className="text-2xl font-bold text-green-500">{studentDetails.stats.totalBadges}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Badges</p>
                      </div>
                      <div className={`p-4 rounded-lg text-center ${isDarkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                        <p className="text-2xl font-bold text-purple-500">{studentDetails.stats.totalEnrollments}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Enrollments</p>
                      </div>
                      <div className={`p-4 rounded-lg text-center ${isDarkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                        {/* show interview count (1 or 0) */}
                        <p className="text-2xl font-bold text-orange-500">{studentDetails.stats.interviewsCount ?? 0}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Interview</p>
                      </div>
                    </div>

                    {/* Projects Section */}
                    {studentDetails.projects.length > 0 && (
                      <div className={`p-6 rounded-lg ${isDarkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                          <BookOpen className="w-5 h-5" /> Projects ({studentDetails.projects.length})
                        </h3>
                        <div className="space-y-4">
                          {studentDetails.projects.map((project) => (
                            <div key={project.id} className={`p-4 rounded-lg border ${isDarkMode ? "border-gray-600 bg-gray-800" : "border-gray-200 bg-white"}`}>
                              <h4 className="font-bold text-lg">{project.title}</h4>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{project.description}</p>
                              {project.tech_stack && (
                                <p className="text-sm mt-2"><span className="font-semibold">Techck:</span> {project.tech_stack}</p>
                              )}
                              {project.github_pr_link && (
                                <a href={project.github_pr_link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm mt-2 inline-flex items-center gap-1">
                                  <Github className="w-4 h-4" /> View on GitHub
                                </a>
                              )}
                              {project.is_open_source && (
                                <span className="ml-2 px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs">Open Source</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Badges Section */}
                    {studentDetails.badges.length > 0 && (
                      <div className={`p-6 rounded-lg ${isDarkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                          <Award className="w-5 h-5" /> Skill Badges ({studentDetails.badges.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {studentDetails.badges.map((badge) => (
                            <div key={badge.id} className={`p-4 rounded-lg border ${isDarkMode ? "border-gray-600 bg-gray-800" : "border-gray-200 bg-white"}`}>
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-bold">{badge.name}</h4>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{badge.description}</p>
                                  <p className="text-xs text-gray-400 mt-2">Awarded: {new Date(badge.awarded_at).toLocaleDateString()}</p>
                                </div>
                                {badge.is_verified && (
                                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">Verified</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Enrollments Section */}
                    {studentDetails.enrollments.length > 0 && (
                      <div className={`p-6 rounded-lg ${isDarkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                          <Calendar className="w-5 h-5" /> Course Enrollments ({studentDetails.enrollments.length})
                        </h3>
                        <div className="space-y-3">
                          {studentDetails.enrollments.map((enrollment) => (
                            <div key={enrollment.id} className={`p-4 rounded-lg border ${isDarkMode ? "border-gray-600 bg-gray-800" : "border-gray-200 bg-white"}`}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-bold">{enrollment.course_name}</h4>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{enrollment.course_description}</p>
                                  <p className="text-xs text-gray-400 mt-2">Enrolled: {new Date(enrollment.enrolled_at).toLocaleDateString()}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                  enrollment.status === 'active' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200'
                                }`}>{enrollment.status}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-center py-8">No details available</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Students;