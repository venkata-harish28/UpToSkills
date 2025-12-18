// src/components/AdminPanelDashboard/Programs.jsx

import React, { useEffect, useState } from "react";
import axios from "axios";
import { FaTrash } from "react-icons/fa";

export default function Programs({ onCoursesUpdate,isDarkMode }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    skills: [""], // Dynamic skills array for input
  });

  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [courses, setCourses] = useState([]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSkillChange = (index, value) => {
    const newSkills = [...formData.skills];
    newSkills[index] = value;
    setFormData((prev) => ({ ...prev, skills: newSkills }));
  };

  const addSkill = () => {
    setFormData((prev) => ({ ...prev, skills: [...prev.skills, ""] }));
  };

  const removeSkill = (index) => {
    const newSkills = formData.skills.filter((_, i) => i !== index);
    setFormData((prev) => ({
      ...prev,
      skills: newSkills.length > 0 ? newSkills : [""],
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    try {
      const data = new FormData();
      data.append("title", formData.title);
      data.append("description", formData.description);
      data.append(
        "skills",
        JSON.stringify(formData.skills.filter((skill) => skill.trim() !== ""))
      );
      if (image) data.append("image", image);

      const res = await axios.post("http://localhost:5000/api/courses", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMessage("✅ Course added successfully!");
      setFormData({ title: "", description: "", skills: [""] });
      setImage(null);
      setPreview(null);

      // Update courses list in this component
      const added = res.data?.course || res.data;
      setCourses((prev) => [added, ...prev]);
      // Notify parent about the updated courses list
      onCoursesUpdate && onCoursesUpdate(res.data);
      // Create a notification for admins about the new program (best-effort)
      try {
        await axios.post("http://localhost:5000/api/notifications", {
          role: "admin",
          type: "creation",
          title: "Program added",
          message: `${added.title || formData.title} was added.`,
          metadata: { entity: "program", id: added.id || null },
        });
      } catch (notifErr) {
        console.error("Failed to create program notification:", notifErr);
      }
    } catch (error) {
      console.error("Error adding course:", error);
      setMessage("❌ Failed to add course. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/courses", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) {
          console.error("Failed to fetch courses:", res.statusText);
          setCourses([]);
          return;
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          setCourses(data);
          onCoursesUpdate && onCoursesUpdate(data);
        } else {
          console.error("Invalid data format:", data);
          setCourses([]);
        }
      } catch (error) {
        console.error("Error fetching courses:", error);
        setCourses([]);
      }
    };

    fetchCourses();
  }, [onCoursesUpdate]);

  const removeCourse = async (id) => {
    if (!window.confirm("Are you sure you want to delete this course?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5000/api/courses/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (data.success) {
        setCourses((prev) => prev.filter((c) => c.id !== id));
        onCoursesUpdate && onCoursesUpdate(courses.filter((c) => c.id !== id));
        // Notify admins about course deletion (best-effort)
        try {
          await axios.post(
            "http://localhost:5000/api/notifications",
            {
              role: "admin",
              type: "deletion",
              title: "Program deleted",
              message: `Program with id ${id} was deleted.`,
              metadata: { entity: "program", id },
            },
            { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
          );
        } catch (notifErr) {
          console.error("Failed to create program deletion notification:", notifErr);
        }
      } else {
        alert(data.message || "Failed to delete course");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting course");
    }
  };

  return (
    <div className={`${isDarkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"} min-h-screen bg-gray-50 dark:bg-gray-950 flex justify-center items-center px-6`}>
      <div className={`${isDarkMode ? "bg-gray-900 text-gray-100 border border:gray-500" : "bg-gray-50 text-gray-900"} shadow-xl rounded-2xl flex flex-col justify-center items-center p-8 w-full max-w-lg `}>
        <h2 className="text-2xl font-bold mb-6 text-center">
          Add New Program
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5 w-full">
          <div>
            <label className="block mb-1 font-medium">
              Program Title
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Cybersecurity"
              required
              className="w-full border text-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Brief description about the course..."
              rows="4"
              required
              className="w-full border text-black border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">
              Skills
            </label>
            {formData.skills.map((skill, index) => (
              <div key={index} className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={skill}
                  onChange={(e) => handleSkillChange(index, e.target.value)}
                  placeholder={`Skill ${index + 1}`}
                  required={index === 0}
                  className="flex-grow border border-gray-300 text-black rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeSkill(index)}
                  disabled={formData.skills.length === 1}
                  className="text-red-600 hover:text-red-800 font-bold"
                >
                  &times;
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addSkill}
              className="text-blue-600 hover:text-blue-800 font-semibold"
            >
              + Add Skill
            </button>
          </div>


          <div class="flex items-center justify-center w-full">
            <label for="dropzone-file" class="flex flex-col items-center justify-center w-full h-50 bg-neutral-secondary-medium border border-dashed border-default-strong rounded cursor-pointer hover:bg-neutral-tertiary-medium">
              <div class="flex flex-col items-center justify-center text-body pt-5 pb-6">
                <svg class="w-8 h-8 mb-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h3a3 3 0 0 0 0-6h-.025a5.56 5.56 0 0 0 .025-.5A5.5 5.5 0 0 0 7.207 9.021C7.137 9.017 7.071 9 7 9a4 4 0 1 0 0 8h2.167M12 19v-9m0 0-2 2m2-2 2 2" /></svg>
                <p class="mb-2 text-sm"><span class="font-semibold">Click to upload</span> or drag and drop</p>
                <p class="text-xs">SVG, PNG, JPG or GIF (MAX. 800x400px)</p>
              </div>
              <input id="dropzone-file" accept="image/*" type="file" class="hidden" onChange={handleImageChange} />
            </label>
          </div>
          {preview && (
            <img
              src={preview}
              alt="Preview"
              className="mt-3 w-full h-50 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
            />
          )}
          {/* <div>
            <label className="block mb-1 font-medium">
          </div> */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-all disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Add Program"}
          </button>
        </form>

        {message && (
          <p
            className={`mt-4 text-center ${message.includes("✅") ? "text-green-600" : "text-red-500"
              }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}