export const mockStudents = [
  {
    id: "pramod-001",
    full_name: "Pramod Kumar",
    email: "pramod0605@gmail.com",
    phone: "+91-9876500605",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Pramod",
    enrollment_date: "2024-01-10",
    last_active: "2025-10-16T17:45:00",
    status: "active",
    courses: [
      {
        id: "course-1",
        name: "JEE Main 2025 Complete",
        subjects: ["Physics", "Chemistry", "Mathematics"],
        progress: 85,
        enrolled_at: "2024-01-10"
      },
      {
        id: "course-2",
        name: "Advanced Mathematics",
        subjects: ["Calculus", "Algebra", "Trigonometry"],
        progress: 92,
        enrolled_at: "2024-02-15"
      }
    ],
    total_progress: 88.5,
    tests_taken: 58,
    avg_test_score: 87,
    ai_queries: 345,
    areas_of_improvement: ["Electrochemistry", "Complex Numbers"],
    followups_pending: 1,
    at_risk: false,
    live_classes: {
      total_scheduled: 60,
      attended: 54,
      attendance_percentage: 90,
      missed: 6,
      upcoming: 5,
      recent_classes: [
        { id: "lc-p001", subject: "Physics", topic: "Modern Physics", date: "2025-10-16", attended: true, duration_minutes: 90 },
        { id: "lc-p002", subject: "Chemistry", topic: "Electrochemistry", date: "2025-10-15", attended: true, duration_minutes: 90 },
        { id: "lc-p003", subject: "Mathematics", topic: "Complex Numbers", date: "2025-10-14", attended: true, duration_minutes: 90 },
        { id: "lc-p004", subject: "Physics", topic: "Atomic Structure", date: "2025-10-13", attended: true, duration_minutes: 90 },
        { id: "lc-p005", subject: "Calculus", topic: "Differential Equations", date: "2025-10-12", attended: false, duration_minutes: 90 }
      ]
    },
    ai_video_usage: {
      total_videos: 178,
      watched_count: 156,
      total_watch_time_minutes: 7020,
      completion_rate: 88,
      recent_videos: [
        { title: "Quantum Mechanics Basics", subject: "Physics", duration: 55, watched_percentage: 100, date: "2025-10-16" },
        { title: "Electrochemistry Advanced", subject: "Chemistry", duration: 60, watched_percentage: 95, date: "2025-10-15" },
        { title: "Complex Numbers Mastery", subject: "Mathematics", duration: 50, watched_percentage: 100, date: "2025-10-14" }
      ]
    },
    podcast_usage: {
      total_listened: 52,
      total_time_minutes: 1560,
      favorite_topics: ["Physics Concepts", "JEE Strategy", "Math Problem Solving"],
      recent_podcasts: [
        { title: "Modern Physics Insights", subject: "Physics", duration: 35, date: "2025-10-15" },
        { title: "JEE Exam Strategy 2025", subject: "General", duration: 30, date: "2025-10-13" },
        { title: "Complex Numbers Tips", subject: "Mathematics", duration: 28, date: "2025-10-12" }
      ]
    },
    mcq_practice: {
      total_attempted: 780,
      total_correct: 679,
      accuracy_percentage: 87,
      by_subject: {
        Physics: { attempted: 260, correct: 234, accuracy: 90 },
        Chemistry: { attempted: 260, correct: 218, accuracy: 84 },
        Mathematics: { attempted: 260, correct: 227, accuracy: 87 }
      },
      recent_sessions: [
        { subject: "Physics", questions: 25, correct: 23, date: "2025-10-16" },
        { subject: "Chemistry", questions: 25, correct: 21, date: "2025-10-15" },
        { subject: "Mathematics", questions: 30, correct: 27, date: "2025-10-14" }
      ]
    },
    doubt_clearing: {
      total_doubts: 48,
      resolved: 45,
      pending: 3,
      avg_resolution_time_minutes: 20,
      by_subject: { Physics: 18, Chemistry: 17, Mathematics: 13 },
      recent_doubts: [
        { question: "Explain Compton Effect in detail", subject: "Physics", status: "resolved", date: "2025-10-16" },
        { question: "Nernst Equation applications", subject: "Chemistry", status: "pending", date: "2025-10-15" },
        { question: "De Moivre's theorem proof", subject: "Mathematics", status: "resolved", date: "2025-10-14" }
      ]
    },
    activity_score: 88,
    activity_breakdown: {
      live_class_participation: 90,
      ai_video_engagement: 88,
      podcast_listening: 85,
      mcq_practice: 91,
      doubt_clearing: 86
    },
    timetable: [
      { day: 1, subject: "Physics", topic: "Modern Physics", start_time: "09:00", end_time: "10:30", instructor: "Dr. Sharma", type: "live_class" },
      { day: 1, subject: "Chemistry", topic: "Electrochemistry", start_time: "11:00", end_time: "12:30", instructor: "Prof. Gupta", type: "live_class" },
      { day: 1, subject: "Mathematics", topic: "Complex Numbers", start_time: "14:00", end_time: "15:30", instructor: "Dr. Patel", type: "live_class" },
      { day: 2, subject: "Physics", topic: "Nuclear Physics", start_time: "09:00", end_time: "10:30", instructor: "Dr. Sharma", type: "live_class" },
      { day: 2, subject: "Chemistry", topic: "Surface Chemistry", start_time: "11:00", end_time: "12:30", instructor: "Prof. Gupta", type: "live_class" },
      { day: 3, subject: "Mathematics", topic: "Calculus Advanced", start_time: "09:00", end_time: "10:30", instructor: "Dr. Patel", type: "live_class" },
      { day: 3, subject: "Physics", topic: "Semiconductor Devices", start_time: "14:00", end_time: "15:30", instructor: "Dr. Sharma", type: "live_class" },
      { day: 4, subject: "Chemistry", topic: "Chemical Kinetics", start_time: "11:00", end_time: "12:30", instructor: "Prof. Gupta", type: "live_class" },
      { day: 4, subject: "Mathematics", topic: "Probability Theory", start_time: "14:00", end_time: "15:30", instructor: "Dr. Patel", type: "live_class" },
      { day: 5, subject: "Physics", topic: "Quantum Mechanics", start_time: "09:00", end_time: "10:30", instructor: "Dr. Sharma", type: "live_class" },
      { day: 5, subject: "Chemistry", topic: "Coordination Chemistry", start_time: "11:00", end_time: "12:30", instructor: "Prof. Gupta", type: "live_class" }
    ],
    notifications: [
      { id: "notif-p001", type: "class" as const, title: "Upcoming Class: Modern Physics", message: "Your Physics class starts in 30 minutes", time: "2025-10-17T09:00:00", read: false, priority: "high" as const },
      { id: "notif-p002", type: "test" as const, title: "Mock Test Available", message: "JEE Main Mock Test 15 is now available", time: "2025-10-16T18:00:00", read: false, priority: "medium" as const },
      { id: "notif-p003", type: "assignment" as const, title: "Assignment Due Soon", message: "Chemistry assignment due in 2 days", time: "2025-10-16T15:00:00", read: true, priority: "medium" as const },
      { id: "notif-p004", type: "doubt" as const, title: "Doubt Resolved", message: "Your doubt on Compton Effect has been answered", time: "2025-10-16T14:30:00", read: true, priority: "low" as const },
      { id: "notif-p005", type: "achievement" as const, title: "Milestone Achieved!", message: "You've completed 50+ AI videos this month!", time: "2025-10-16T12:00:00", read: false, priority: "low" as const }
    ]
  },
  {
    id: "stu-001",
    full_name: "Aarav Sharma",
    email: "aarav.sharma@email.com",
    phone: "+91-9876543210",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aarav",
    enrollment_date: "2024-01-15",
    last_active: "2025-10-16T14:30:00",
    status: "active",
    courses: [
      {
        id: "course-1",
        name: "JEE Main 2025 Complete",
        subjects: ["Physics", "Chemistry", "Mathematics"],
        progress: 67,
        enrolled_at: "2024-01-15"
      },
      {
        id: "course-2",
        name: "Advanced Mathematics",
        subjects: ["Calculus", "Algebra", "Trigonometry"],
        progress: 82,
        enrolled_at: "2024-03-20"
      }
    ],
    total_progress: 74.5,
    tests_taken: 45,
    avg_test_score: 78,
    ai_queries: 234,
    areas_of_improvement: ["Organic Chemistry", "Calculus Integration"],
    followups_pending: 2,
    at_risk: false,
    live_classes: {
      total_scheduled: 48,
      attended: 40,
      attendance_percentage: 83,
      missed: 8,
      upcoming: 3,
      recent_classes: [
        { id: "lc-001", subject: "Physics", topic: "Thermodynamics", date: "2025-10-15", attended: true, duration_minutes: 90 },
        { id: "lc-002", subject: "Chemistry", topic: "Chemical Bonding", date: "2025-10-14", attended: true, duration_minutes: 90 },
        { id: "lc-003", subject: "Mathematics", topic: "Calculus", date: "2025-10-13", attended: false, duration_minutes: 90 },
        { id: "lc-004", subject: "Physics", topic: "Optics", date: "2025-10-12", attended: true, duration_minutes: 90 },
        { id: "lc-005", subject: "Algebra", topic: "Matrices", date: "2025-10-11", attended: true, duration_minutes: 90 }
      ]
    },
    ai_video_usage: {
      total_videos: 125,
      watched_count: 98,
      total_watch_time_minutes: 4410,
      completion_rate: 78,
      recent_videos: [
        { title: "Newton's Laws Deep Dive", subject: "Physics", duration: 45, watched_percentage: 100, date: "2025-10-15" },
        { title: "Organic Chemistry Basics", subject: "Chemistry", duration: 60, watched_percentage: 75, date: "2025-10-14" },
        { title: "Integration Techniques", subject: "Mathematics", duration: 50, watched_percentage: 100, date: "2025-10-13" }
      ]
    },
    podcast_usage: {
      total_listened: 32,
      total_time_minutes: 960,
      favorite_topics: ["Physics Concepts", "Math Problem Solving"],
      recent_podcasts: [
        { title: "Physics in Daily Life", subject: "Physics", duration: 30, date: "2025-10-14" },
        { title: "Chemistry Shortcuts", subject: "Chemistry", duration: 25, date: "2025-10-12" }
      ]
    },
    mcq_practice: {
      total_attempted: 450,
      total_correct: 360,
      accuracy_percentage: 80,
      by_subject: {
        Physics: { attempted: 150, correct: 125, accuracy: 83 },
        Chemistry: { attempted: 150, correct: 110, accuracy: 73 },
        Mathematics: { attempted: 150, correct: 125, accuracy: 83 }
      },
      recent_sessions: [
        { subject: "Physics", questions: 20, correct: 17, date: "2025-10-15" },
        { subject: "Chemistry", questions: 20, correct: 14, date: "2025-10-14" }
      ]
    },
    doubt_clearing: {
      total_doubts: 35,
      resolved: 32,
      pending: 3,
      avg_resolution_time_minutes: 25,
      by_subject: { Physics: 12, Chemistry: 15, Mathematics: 8 },
      recent_doubts: [
        { question: "How to solve quadratic equations faster?", subject: "Mathematics", status: "resolved", date: "2025-10-15" },
        { question: "Explain Le Chatelier's Principle", subject: "Chemistry", status: "pending", date: "2025-10-14" }
      ]
    },
    activity_score: 82,
    activity_breakdown: {
      live_class_participation: 83,
      ai_video_engagement: 78,
      podcast_listening: 76,
      mcq_practice: 85,
      doubt_clearing: 88
    },
    timetable: [
      { day: 1, subject: "Physics", topic: "Mechanics", start_time: "09:00", end_time: "10:30", instructor: "Dr. Sharma", type: "live_class" },
      { day: 1, subject: "Chemistry", topic: "Organic Chemistry", start_time: "11:00", end_time: "12:30", instructor: "Prof. Gupta", type: "live_class" },
      { day: 2, subject: "Mathematics", topic: "Calculus", start_time: "09:00", end_time: "10:30", instructor: "Dr. Patel", type: "live_class" },
      { day: 3, subject: "Physics", topic: "Thermodynamics", start_time: "09:00", end_time: "10:30", instructor: "Dr. Sharma", type: "live_class" },
      { day: 4, subject: "Algebra", topic: "Matrices", start_time: "14:00", end_time: "15:30", instructor: "Dr. Patel", type: "live_class" },
      { day: 5, subject: "Chemistry", topic: "Physical Chemistry", start_time: "11:00", end_time: "12:30", instructor: "Prof. Gupta", type: "live_class" }
    ]
  },
  {
    id: "stu-002",
    full_name: "Priya Patel",
    email: "priya.patel@email.com",
    phone: "+91-9876543211",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Priya",
    enrollment_date: "2024-02-20",
    last_active: "2025-10-16T09:15:00",
    status: "active",
    courses: [
      {
        id: "course-3",
        name: "NEET 2025 Biology",
        subjects: ["Biology", "Chemistry", "Physics"],
        progress: 89,
        enrolled_at: "2024-02-20"
      }
    ],
    total_progress: 89,
    tests_taken: 67,
    avg_test_score: 92,
    ai_queries: 189,
    areas_of_improvement: ["Physics Mechanics"],
    followups_pending: 0,
    at_risk: false,
    live_classes: {
      total_scheduled: 52,
      attended: 50,
      attendance_percentage: 96,
      missed: 2,
      upcoming: 4,
      recent_classes: [
        { id: "lc-011", subject: "Biology", topic: "Cell Biology", date: "2025-10-15", attended: true, duration_minutes: 90 },
        { id: "lc-012", subject: "Physics", topic: "Electromagnetism", date: "2025-10-14", attended: true, duration_minutes: 90 },
        { id: "lc-013", subject: "Chemistry", topic: "Equilibrium", date: "2025-10-13", attended: true, duration_minutes: 90 },
        { id: "lc-014", subject: "Biology", topic: "Genetics", date: "2025-10-12", attended: true, duration_minutes: 90 },
        { id: "lc-015", subject: "Physics", topic: "Waves", date: "2025-10-11", attended: true, duration_minutes: 90 }
      ]
    },
    ai_video_usage: {
      total_videos: 145,
      watched_count: 138,
      total_watch_time_minutes: 6210,
      completion_rate: 95,
      recent_videos: [
        { title: "Cell Division Explained", subject: "Biology", duration: 50, watched_percentage: 100, date: "2025-10-15" },
        { title: "Electromagnetic Induction", subject: "Physics", duration: 55, watched_percentage: 100, date: "2025-10-14" },
        { title: "Chemical Equilibrium", subject: "Chemistry", duration: 45, watched_percentage: 100, date: "2025-10-13" }
      ]
    },
    podcast_usage: {
      total_listened: 45,
      total_time_minutes: 1350,
      favorite_topics: ["Biology Concepts", "Exam Strategies"],
      recent_podcasts: [
        { title: "NEET Biology Tips", subject: "Biology", duration: 30, date: "2025-10-15" },
        { title: "Time Management for Exams", subject: "General", duration: 25, date: "2025-10-13" }
      ]
    },
    mcq_practice: {
      total_attempted: 680,
      total_correct: 625,
      accuracy_percentage: 92,
      by_subject: {
        Biology: { attempted: 240, correct: 228, accuracy: 95 },
        Physics: { attempted: 220, correct: 200, accuracy: 91 },
        Chemistry: { attempted: 220, correct: 197, accuracy: 90 }
      },
      recent_sessions: [
        { subject: "Biology", questions: 25, correct: 24, date: "2025-10-15" },
        { subject: "Physics", questions: 25, correct: 23, date: "2025-10-14" }
      ]
    },
    doubt_clearing: {
      total_doubts: 28,
      resolved: 28,
      pending: 0,
      avg_resolution_time_minutes: 18,
      by_subject: { Biology: 15, Physics: 8, Chemistry: 5 },
      recent_doubts: [
        { question: "DNA replication mechanism", subject: "Biology", status: "resolved", date: "2025-10-14" },
        { question: "Faraday's law application", subject: "Physics", status: "resolved", date: "2025-10-13" }
      ]
    },
    activity_score: 95,
    activity_breakdown: {
      live_class_participation: 96,
      ai_video_engagement: 95,
      podcast_listening: 92,
      mcq_practice: 96,
      doubt_clearing: 95
    },
    timetable: [
      { day: 1, subject: "Biology", topic: "Cell Biology", start_time: "09:00", end_time: "10:30", instructor: "Dr. Mehta", type: "live_class" },
      { day: 1, subject: "Physics", topic: "Modern Physics", start_time: "11:00", end_time: "12:30", instructor: "Dr. Sharma", type: "live_class" },
      { day: 2, subject: "Chemistry", topic: "Inorganic Chemistry", start_time: "09:00", end_time: "10:30", instructor: "Prof. Gupta", type: "live_class" },
      { day: 2, subject: "Biology", topic: "Genetics", start_time: "14:00", end_time: "15:30", instructor: "Dr. Mehta", type: "live_class" },
      { day: 3, subject: "Physics", topic: "Electromagnetism", start_time: "09:00", end_time: "10:30", instructor: "Dr. Sharma", type: "live_class" },
      { day: 4, subject: "Chemistry", topic: "Organic Chemistry", start_time: "11:00", end_time: "12:30", instructor: "Prof. Gupta", type: "live_class" },
      { day: 5, subject: "Biology", topic: "Ecology", start_time: "09:00", end_time: "10:30", instructor: "Dr. Mehta", type: "live_class" }
    ]
  },
  {
    id: "stu-003",
    full_name: "Rohan Kumar",
    email: "rohan.kumar@email.com",
    phone: "+91-9876543212",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rohan",
    enrollment_date: "2024-03-10",
    last_active: "2025-10-15T22:45:00",
    status: "at_risk",
    courses: [
      {
        id: "course-1",
        name: "JEE Main 2025 Complete",
        subjects: ["Physics", "Chemistry", "Mathematics"],
        progress: 34,
        enrolled_at: "2024-03-10"
      }
    ],
    total_progress: 34,
    tests_taken: 12,
    avg_test_score: 45,
    ai_queries: 67,
    areas_of_improvement: ["All subjects - low engagement"],
    followups_pending: 5,
    at_risk: true,
    live_classes: {
      total_scheduled: 42,
      attended: 22,
      attendance_percentage: 52,
      missed: 20,
      upcoming: 3,
      recent_classes: [
        { id: "lc-021", subject: "Physics", topic: "Mechanics", date: "2025-10-15", attended: false, duration_minutes: 90 },
        { id: "lc-022", subject: "Chemistry", topic: "Atomic Structure", date: "2025-10-14", attended: false, duration_minutes: 90 },
        { id: "lc-023", subject: "Mathematics", topic: "Functions", date: "2025-10-13", attended: true, duration_minutes: 90 },
        { id: "lc-024", subject: "Physics", topic: "Kinematics", date: "2025-10-12", attended: false, duration_minutes: 90 },
        { id: "lc-025", subject: "Chemistry", topic: "Periodic Table", date: "2025-10-11", attended: true, duration_minutes: 90 }
      ]
    },
    ai_video_usage: {
      total_videos: 98,
      watched_count: 35,
      total_watch_time_minutes: 1225,
      completion_rate: 36,
      recent_videos: [
        { title: "Basic Physics Concepts", subject: "Physics", duration: 40, watched_percentage: 50, date: "2025-10-14" },
        { title: "Chemistry Fundamentals", subject: "Chemistry", duration: 45, watched_percentage: 40, date: "2025-10-12" }
      ]
    },
    podcast_usage: {
      total_listened: 8,
      total_time_minutes: 180,
      favorite_topics: ["Study Tips"],
      recent_podcasts: [
        { title: "How to Stay Motivated", subject: "General", duration: 20, date: "2025-10-13" }
      ]
    },
    mcq_practice: {
      total_attempted: 120,
      total_correct: 54,
      accuracy_percentage: 45,
      by_subject: {
        Physics: { attempted: 40, correct: 18, accuracy: 45 },
        Chemistry: { attempted: 40, correct: 17, accuracy: 43 },
        Mathematics: { attempted: 40, correct: 19, accuracy: 48 }
      },
      recent_sessions: [
        { subject: "Physics", questions: 10, correct: 4, date: "2025-10-14" },
        { subject: "Mathematics", questions: 10, correct: 5, date: "2025-10-12" }
      ]
    },
    doubt_clearing: {
      total_doubts: 18,
      resolved: 12,
      pending: 6,
      avg_resolution_time_minutes: 45,
      by_subject: { Physics: 7, Chemistry: 6, Mathematics: 5 },
      recent_doubts: [
        { question: "Basic differentiation rules", subject: "Mathematics", status: "pending", date: "2025-10-14" },
        { question: "Newton's laws understanding", subject: "Physics", status: "pending", date: "2025-10-13" }
      ]
    },
    activity_score: 45,
    activity_breakdown: {
      live_class_participation: 52,
      ai_video_engagement: 36,
      podcast_listening: 38,
      mcq_practice: 45,
      doubt_clearing: 52
    },
    timetable: [
      { day: 1, subject: "Physics", topic: "Mechanics", start_time: "09:00", end_time: "10:30", instructor: "Dr. Sharma", type: "live_class" },
      { day: 1, subject: "Chemistry", topic: "Atomic Structure", start_time: "11:00", end_time: "12:30", instructor: "Prof. Gupta", type: "live_class" },
      { day: 2, subject: "Mathematics", topic: "Functions", start_time: "09:00", end_time: "10:30", instructor: "Dr. Patel", type: "live_class" },
      { day: 3, subject: "Physics", topic: "Kinematics", start_time: "09:00", end_time: "10:30", instructor: "Dr. Sharma", type: "live_class" },
      { day: 4, subject: "Chemistry", topic: "Chemical Bonding", start_time: "11:00", end_time: "12:30", instructor: "Prof. Gupta", type: "live_class" }
    ]
  },
  {
    id: "stu-004",
    full_name: "Ananya Singh",
    email: "ananya.singh@email.com",
    phone: "+91-9876543213",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ananya",
    enrollment_date: "2024-01-05",
    last_active: "2025-10-16T16:20:00",
    status: "active",
    courses: [
      {
        id: "course-4",
        name: "Class 12 Board Prep",
        subjects: ["Mathematics", "Physics", "Chemistry", "English"],
        progress: 78,
        enrolled_at: "2024-01-05"
      },
      {
        id: "course-1",
        name: "JEE Main 2025 Complete",
        subjects: ["Physics", "Chemistry", "Mathematics"],
        progress: 71,
        enrolled_at: "2024-01-15"
      }
    ],
    total_progress: 74.5,
    tests_taken: 52,
    avg_test_score: 81,
    ai_queries: 312,
    areas_of_improvement: ["Organic Chemistry Reactions"],
    followups_pending: 1,
    at_risk: false,
    live_classes: {
      total_scheduled: 56,
      attended: 47,
      attendance_percentage: 84,
      missed: 9,
      upcoming: 4,
      recent_classes: [
        { id: "lc-031", subject: "Mathematics", topic: "Differential Equations", date: "2025-10-15", attended: true, duration_minutes: 90 },
        { id: "lc-032", subject: "Physics", topic: "Semiconductor Devices", date: "2025-10-14", attended: true, duration_minutes: 90 },
        { id: "lc-033", subject: "Chemistry", topic: "Coordination Compounds", date: "2025-10-13", attended: false, duration_minutes: 90 },
        { id: "lc-034", subject: "English", topic: "Essay Writing", date: "2025-10-12", attended: true, duration_minutes: 60 },
        { id: "lc-035", subject: "Mathematics", topic: "Probability", date: "2025-10-11", attended: true, duration_minutes: 90 }
      ]
    },
    ai_video_usage: {
      total_videos: 152,
      watched_count: 128,
      total_watch_time_minutes: 5760,
      completion_rate: 84,
      recent_videos: [
        { title: "Differential Equations Solutions", subject: "Mathematics", duration: 55, watched_percentage: 100, date: "2025-10-15" },
        { title: "Semiconductor Physics", subject: "Physics", duration: 50, watched_percentage: 90, date: "2025-10-14" },
        { title: "Coordination Chemistry", subject: "Chemistry", duration: 45, watched_percentage: 80, date: "2025-10-13" }
      ]
    },
    podcast_usage: {
      total_listened: 38,
      total_time_minutes: 1140,
      favorite_topics: ["Board Exam Strategies", "JEE Preparation"],
      recent_podcasts: [
        { title: "Board Exam Success Tips", subject: "General", duration: 30, date: "2025-10-14" },
        { title: "Chemistry Memory Techniques", subject: "Chemistry", duration: 25, date: "2025-10-12" }
      ]
    },
    mcq_practice: {
      total_attempted: 520,
      total_correct: 421,
      accuracy_percentage: 81,
      by_subject: {
        Mathematics: { attempted: 140, correct: 119, accuracy: 85 },
        Physics: { attempted: 130, correct: 104, accuracy: 80 },
        Chemistry: { attempted: 130, correct: 98, accuracy: 75 },
        English: { attempted: 120, correct: 100, accuracy: 83 }
      },
      recent_sessions: [
        { subject: "Mathematics", questions: 25, correct: 21, date: "2025-10-15" },
        { subject: "Physics", questions: 20, correct: 16, date: "2025-10-14" }
      ]
    },
    doubt_clearing: {
      total_doubts: 42,
      resolved: 39,
      pending: 3,
      avg_resolution_time_minutes: 22,
      by_subject: { Mathematics: 14, Physics: 12, Chemistry: 13, English: 3 },
      recent_doubts: [
        { question: "Solving second order differential equations", subject: "Mathematics", status: "resolved", date: "2025-10-15" },
        { question: "P-N junction diode working", subject: "Physics", status: "pending", date: "2025-10-14" }
      ]
    },
    activity_score: 84,
    activity_breakdown: {
      live_class_participation: 84,
      ai_video_engagement: 84,
      podcast_listening: 80,
      mcq_practice: 86,
      doubt_clearing: 85
    },
    timetable: [
      { day: 1, subject: "Mathematics", topic: "Differential Equations", start_time: "09:00", end_time: "10:30", instructor: "Dr. Patel", type: "live_class" },
      { day: 1, subject: "Physics", topic: "Semiconductor Devices", start_time: "11:00", end_time: "12:30", instructor: "Dr. Sharma", type: "live_class" },
      { day: 2, subject: "Chemistry", topic: "Coordination Compounds", start_time: "09:00", end_time: "10:30", instructor: "Prof. Gupta", type: "live_class" },
      { day: 2, subject: "English", topic: "Essay Writing", start_time: "14:00", end_time: "15:00", instructor: "Prof. Nair", type: "live_class" },
      { day: 3, subject: "Mathematics", topic: "Probability", start_time: "09:00", end_time: "10:30", instructor: "Dr. Patel", type: "live_class" },
      { day: 4, subject: "Physics", topic: "Communication Systems", start_time: "11:00", end_time: "12:30", instructor: "Dr. Sharma", type: "live_class" },
      { day: 5, subject: "Chemistry", topic: "Polymers", start_time: "09:00", end_time: "10:30", instructor: "Prof. Gupta", type: "live_class" }
    ]
  },
  {
    id: "stu-005",
    full_name: "Arjun Mehta",
    email: "arjun.mehta@email.com",
    phone: "+91-9876543214",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Arjun",
    enrollment_date: "2024-04-12",
    last_active: "2025-10-14T11:30:00",
    status: "inactive",
    courses: [
      {
        id: "course-2",
        name: "Advanced Mathematics",
        subjects: ["Calculus", "Algebra", "Trigonometry"],
        progress: 18,
        enrolled_at: "2024-04-12"
      }
    ],
    total_progress: 18,
    tests_taken: 5,
    avg_test_score: 52,
    ai_queries: 23,
    areas_of_improvement: ["Not engaged - needs follow-up"],
    followups_pending: 3,
    at_risk: true,
    live_classes: {
      total_scheduled: 35,
      attended: 12,
      attendance_percentage: 34,
      missed: 23,
      upcoming: 2,
      recent_classes: [
        { id: "lc-041", subject: "Calculus", topic: "Limits", date: "2025-10-14", attended: false, duration_minutes: 90 },
        { id: "lc-042", subject: "Algebra", topic: "Polynomials", date: "2025-10-13", attended: false, duration_minutes: 90 },
        { id: "lc-043", subject: "Trigonometry", topic: "Identities", date: "2025-10-12", attended: false, duration_minutes: 90 },
        { id: "lc-044", subject: "Calculus", topic: "Continuity", date: "2025-10-11", attended: true, duration_minutes: 90 },
        { id: "lc-045", subject: "Algebra", topic: "Quadratic Equations", date: "2025-10-10", attended: false, duration_minutes: 90 }
      ]
    },
    ai_video_usage: {
      total_videos: 85,
      watched_count: 18,
      total_watch_time_minutes: 630,
      completion_rate: 21,
      recent_videos: [
        { title: "Limits Introduction", subject: "Calculus", duration: 35, watched_percentage: 30, date: "2025-10-13" },
        { title: "Polynomial Basics", subject: "Algebra", duration: 40, watched_percentage: 25, date: "2025-10-11" }
      ]
    },
    podcast_usage: {
      total_listened: 3,
      total_time_minutes: 75,
      favorite_topics: [],
      recent_podcasts: [
        { title: "Math Study Tips", subject: "General", duration: 25, date: "2025-10-12" }
      ]
    },
    mcq_practice: {
      total_attempted: 50,
      total_correct: 26,
      accuracy_percentage: 52,
      by_subject: {
        Calculus: { attempted: 20, correct: 10, accuracy: 50 },
        Algebra: { attempted: 15, correct: 8, accuracy: 53 },
        Trigonometry: { attempted: 15, correct: 8, accuracy: 53 }
      },
      recent_sessions: [
        { subject: "Calculus", questions: 10, correct: 5, date: "2025-10-13" }
      ]
    },
    doubt_clearing: {
      total_doubts: 12,
      resolved: 6,
      pending: 6,
      avg_resolution_time_minutes: 60,
      by_subject: { Calculus: 5, Algebra: 4, Trigonometry: 3 },
      recent_doubts: [
        { question: "What are limits?", subject: "Calculus", status: "pending", date: "2025-10-13" },
        { question: "How to factor polynomials?", subject: "Algebra", status: "pending", date: "2025-10-12" }
      ]
    },
    activity_score: 28,
    activity_breakdown: {
      live_class_participation: 34,
      ai_video_engagement: 21,
      podcast_listening: 18,
      mcq_practice: 32,
      doubt_clearing: 35
    },
    timetable: [
      { day: 1, subject: "Calculus", topic: "Limits and Continuity", start_time: "09:00", end_time: "10:30", instructor: "Dr. Patel", type: "live_class" },
      { day: 2, subject: "Algebra", topic: "Polynomials", start_time: "11:00", end_time: "12:30", instructor: "Dr. Patel", type: "live_class" },
      { day: 3, subject: "Trigonometry", topic: "Identities", start_time: "09:00", end_time: "10:30", instructor: "Dr. Patel", type: "live_class" },
      { day: 4, subject: "Calculus", topic: "Derivatives", start_time: "09:00", end_time: "10:30", instructor: "Dr. Patel", type: "live_class" }
    ]
  },
  {
    id: "stu-006",
    full_name: "Kavya Reddy",
    email: "kavya.reddy@email.com",
    phone: "+91-9876543215",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kavya",
    enrollment_date: "2023-12-01",
    last_active: "2025-10-16T13:45:00",
    status: "active",
    courses: [
      {
        id: "course-3",
        name: "NEET 2025 Biology",
        subjects: ["Biology", "Chemistry", "Physics"],
        progress: 95,
        enrolled_at: "2023-12-01"
      }
    ],
    total_progress: 95,
    tests_taken: 89,
    avg_test_score: 94,
    ai_queries: 401,
    areas_of_improvement: ["None - Excellent performance"],
    followups_pending: 0,
    at_risk: false,
    live_classes: {
      total_scheduled: 68,
      attended: 66,
      attendance_percentage: 97,
      missed: 2,
      upcoming: 5,
      recent_classes: [
        { id: "lc-051", subject: "Biology", topic: "Human Physiology", date: "2025-10-15", attended: true, duration_minutes: 90 },
        { id: "lc-052", subject: "Chemistry", topic: "Biomolecules", date: "2025-10-14", attended: true, duration_minutes: 90 },
        { id: "lc-053", subject: "Physics", topic: "Ray Optics", date: "2025-10-13", attended: true, duration_minutes: 90 },
        { id: "lc-054", subject: "Biology", topic: "Plant Physiology", date: "2025-10-12", attended: true, duration_minutes: 90 },
        { id: "lc-055", subject: "Chemistry", topic: "Organic Compounds", date: "2025-10-11", attended: true, duration_minutes: 90 }
      ]
    },
    ai_video_usage: {
      total_videos: 178,
      watched_count: 172,
      total_watch_time_minutes: 7740,
      completion_rate: 97,
      recent_videos: [
        { title: "Human Circulatory System", subject: "Biology", duration: 60, watched_percentage: 100, date: "2025-10-15" },
        { title: "Biomolecules Classification", subject: "Chemistry", duration: 50, watched_percentage: 100, date: "2025-10-14" },
        { title: "Ray Optics and Lenses", subject: "Physics", duration: 55, watched_percentage: 100, date: "2025-10-13" }
      ]
    },
    podcast_usage: {
      total_listened: 58,
      total_time_minutes: 1740,
      favorite_topics: ["NEET Strategies", "Biology Deep Dive"],
      recent_podcasts: [
        { title: "NEET Success Stories", subject: "General", duration: 30, date: "2025-10-15" },
        { title: "Human Body Systems", subject: "Biology", duration: 35, date: "2025-10-13" }
      ]
    },
    mcq_practice: {
      total_attempted: 890,
      total_correct: 836,
      accuracy_percentage: 94,
      by_subject: {
        Biology: { attempted: 320, correct: 307, accuracy: 96 },
        Chemistry: { attempted: 285, correct: 265, accuracy: 93 },
        Physics: { attempted: 285, correct: 264, accuracy: 93 }
      },
      recent_sessions: [
        { subject: "Biology", questions: 30, correct: 29, date: "2025-10-15" },
        { subject: "Chemistry", questions: 30, correct: 28, date: "2025-10-14" }
      ]
    },
    doubt_clearing: {
      total_doubts: 45,
      resolved: 45,
      pending: 0,
      avg_resolution_time_minutes: 15,
      by_subject: { Biology: 22, Chemistry: 13, Physics: 10 },
      recent_doubts: [
        { question: "Hormonal regulation in humans", subject: "Biology", status: "resolved", date: "2025-10-15" },
        { question: "Protein structure levels", subject: "Chemistry", status: "resolved", date: "2025-10-14" }
      ]
    },
    activity_score: 97,
    activity_breakdown: {
      live_class_participation: 97,
      ai_video_engagement: 97,
      podcast_listening: 95,
      mcq_practice: 98,
      doubt_clearing: 98
    },
    timetable: [
      { day: 1, subject: "Biology", topic: "Human Physiology", start_time: "09:00", end_time: "10:30", instructor: "Dr. Mehta", type: "live_class" },
      { day: 1, subject: "Chemistry", topic: "Biomolecules", start_time: "11:00", end_time: "12:30", instructor: "Prof. Gupta", type: "live_class" },
      { day: 2, subject: "Physics", topic: "Ray Optics", start_time: "09:00", end_time: "10:30", instructor: "Dr. Sharma", type: "live_class" },
      { day: 2, subject: "Biology", topic: "Plant Physiology", start_time: "14:00", end_time: "15:30", instructor: "Dr. Mehta", type: "live_class" },
      { day: 3, subject: "Chemistry", topic: "Organic Compounds", start_time: "09:00", end_time: "10:30", instructor: "Prof. Gupta", type: "live_class" },
      { day: 4, subject: "Biology", topic: "Genetics and Evolution", start_time: "11:00", end_time: "12:30", instructor: "Dr. Mehta", type: "live_class" },
      { day: 5, subject: "Physics", topic: "Modern Physics", start_time: "09:00", end_time: "10:30", instructor: "Dr. Sharma", type: "live_class" }
    ]
  },
  {
    id: "stu-007",
    full_name: "Vikram Joshi",
    email: "vikram.joshi@email.com",
    phone: "+91-9876543216",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Vikram",
    enrollment_date: "2024-02-28",
    last_active: "2025-10-16T08:00:00",
    status: "active",
    courses: [
      {
        id: "course-1",
        name: "JEE Main 2025 Complete",
        subjects: ["Physics", "Chemistry", "Mathematics"],
        progress: 56,
        enrolled_at: "2024-02-28"
      }
    ],
    total_progress: 56,
    tests_taken: 32,
    avg_test_score: 68,
    ai_queries: 156,
    areas_of_improvement: ["Mathematics - Coordinate Geometry", "Physics - Modern Physics"],
    followups_pending: 2,
    at_risk: false,
    live_classes: {
      total_scheduled: 44,
      attended: 35,
      attendance_percentage: 80,
      missed: 9,
      upcoming: 3,
      recent_classes: [
        { id: "lc-061", subject: "Physics", topic: "Atomic Structure", date: "2025-10-15", attended: true, duration_minutes: 90 },
        { id: "lc-062", subject: "Chemistry", topic: "Solutions", date: "2025-10-14", attended: false, duration_minutes: 90 },
        { id: "lc-063", subject: "Mathematics", topic: "3D Geometry", date: "2025-10-13", attended: true, duration_minutes: 90 },
        { id: "lc-064", subject: "Physics", topic: "Nuclear Physics", date: "2025-10-12", attended: true, duration_minutes: 90 },
        { id: "lc-065", subject: "Mathematics", topic: "Vectors", date: "2025-10-11", attended: true, duration_minutes: 90 }
      ]
    },
    ai_video_usage: {
      total_videos: 115,
      watched_count: 82,
      total_watch_time_minutes: 3690,
      completion_rate: 71,
      recent_videos: [
        { title: "Atomic Models Evolution", subject: "Physics", duration: 45, watched_percentage: 100, date: "2025-10-15" },
        { title: "3D Coordinate Geometry", subject: "Mathematics", duration: 50, watched_percentage: 85, date: "2025-10-13" },
        { title: "Solution Concentration", subject: "Chemistry", duration: 40, watched_percentage: 60, date: "2025-10-12" }
      ]
    },
    podcast_usage: {
      total_listened: 24,
      total_time_minutes: 720,
      favorite_topics: ["JEE Tips", "Problem Solving"],
      recent_podcasts: [
        { title: "JEE Mathematics Tips", subject: "Mathematics", duration: 30, date: "2025-10-14" },
        { title: "Physics Concepts Simplified", subject: "Physics", duration: 28, date: "2025-10-12" }
      ]
    },
    mcq_practice: {
      total_attempted: 320,
      total_correct: 218,
      accuracy_percentage: 68,
      by_subject: {
        Physics: { attempted: 110, correct: 77, accuracy: 70 },
        Chemistry: { attempted: 105, correct: 68, accuracy: 65 },
        Mathematics: { attempted: 105, correct: 73, accuracy: 70 }
      },
      recent_sessions: [
        { subject: "Physics", questions: 20, correct: 14, date: "2025-10-15" },
        { subject: "Mathematics", questions: 20, correct: 14, date: "2025-10-13" }
      ]
    },
    doubt_clearing: {
      total_doubts: 32,
      resolved: 28,
      pending: 4,
      avg_resolution_time_minutes: 28,
      by_subject: { Physics: 12, Chemistry: 8, Mathematics: 12 },
      recent_doubts: [
        { question: "Understanding photoelectric effect", subject: "Physics", status: "resolved", date: "2025-10-15" },
        { question: "3D coordinate system visualization", subject: "Mathematics", status: "pending", date: "2025-10-13" }
      ]
    },
    activity_score: 75,
    activity_breakdown: {
      live_class_participation: 80,
      ai_video_engagement: 71,
      podcast_listening: 68,
      mcq_practice: 73,
      doubt_clearing: 78
    },
    timetable: [
      { day: 1, subject: "Physics", topic: "Modern Physics", start_time: "09:00", end_time: "10:30", instructor: "Dr. Sharma", type: "live_class" },
      { day: 1, subject: "Chemistry", topic: "Solutions", start_time: "11:00", end_time: "12:30", instructor: "Prof. Gupta", type: "live_class" },
      { day: 2, subject: "Mathematics", topic: "3D Geometry", start_time: "09:00", end_time: "10:30", instructor: "Dr. Patel", type: "live_class" },
      { day: 3, subject: "Physics", topic: "Nuclear Physics", start_time: "09:00", end_time: "10:30", instructor: "Dr. Sharma", type: "live_class" },
      { day: 4, subject: "Mathematics", topic: "Vectors", start_time: "11:00", end_time: "12:30", instructor: "Dr. Patel", type: "live_class" },
      { day: 5, subject: "Chemistry", topic: "Electrochemistry", start_time: "09:00", end_time: "10:30", instructor: "Prof. Gupta", type: "live_class" }
    ]
  },
  {
    id: "stu-008",
    full_name: "Ishita Agarwal",
    email: "ishita.agarwal@email.com",
    phone: "+91-9876543217",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ishita",
    enrollment_date: "2024-03-15",
    last_active: "2025-10-16T17:30:00",
    status: "active",
    courses: [
      {
        id: "course-4",
        name: "Class 12 Board Prep",
        subjects: ["Mathematics", "Physics", "Chemistry", "English"],
        progress: 72,
        enrolled_at: "2024-03-15"
      }
    ],
    total_progress: 72,
    tests_taken: 41,
    avg_test_score: 76,
    ai_queries: 198,
    areas_of_improvement: ["Chemistry - Electrochemistry"],
    followups_pending: 1,
    at_risk: false,
    live_classes: {
      total_scheduled: 50,
      attended: 41,
      attendance_percentage: 82,
      missed: 9,
      upcoming: 4,
      recent_classes: [
        { id: "lc-071", subject: "Mathematics", topic: "Determinants", date: "2025-10-15", attended: true, duration_minutes: 90 },
        { id: "lc-072", subject: "Chemistry", topic: "Electrochemistry", date: "2025-10-14", attended: true, duration_minutes: 90 },
        { id: "lc-073", subject: "Physics", topic: "Alternating Current", date: "2025-10-13", attended: false, duration_minutes: 90 },
        { id: "lc-074", subject: "English", topic: "Poetry Analysis", date: "2025-10-12", attended: true, duration_minutes: 60 },
        { id: "lc-075", subject: "Mathematics", topic: "Matrices", date: "2025-10-11", attended: true, duration_minutes: 90 }
      ]
    },
    ai_video_usage: {
      total_videos: 132,
      watched_count: 106,
      total_watch_time_minutes: 4770,
      completion_rate: 80,
      recent_videos: [
        { title: "Determinants Properties", subject: "Mathematics", duration: 45, watched_percentage: 100, date: "2025-10-15" },
        { title: "Electrochemical Cells", subject: "Chemistry", duration: 50, watched_percentage: 85, date: "2025-10-14" },
        { title: "AC Circuits Analysis", subject: "Physics", duration: 48, watched_percentage: 75, date: "2025-10-13" }
      ]
    },
    podcast_usage: {
      total_listened: 29,
      total_time_minutes: 870,
      favorite_topics: ["Board Exam Tips", "English Literature"],
      recent_podcasts: [
        { title: "Board Exam Time Management", subject: "General", duration: 30, date: "2025-10-14" },
        { title: "Poetry Appreciation Guide", subject: "English", duration: 25, date: "2025-10-12" }
      ]
    },
    mcq_practice: {
      total_attempted: 410,
      total_correct: 312,
      accuracy_percentage: 76,
      by_subject: {
        Mathematics: { attempted: 120, correct: 96, accuracy: 80 },
        Physics: { attempted: 110, correct: 82, accuracy: 75 },
        Chemistry: { attempted: 100, correct: 72, accuracy: 72 },
        English: { attempted: 80, correct: 62, accuracy: 78 }
      },
      recent_sessions: [
        { subject: "Mathematics", questions: 20, correct: 16, date: "2025-10-15" },
        { subject: "Chemistry", questions: 20, correct: 14, date: "2025-10-14" }
      ]
    },
    doubt_clearing: {
      total_doubts: 36,
      resolved: 33,
      pending: 3,
      avg_resolution_time_minutes: 26,
      by_subject: { Mathematics: 11, Physics: 10, Chemistry: 12, English: 3 },
      recent_doubts: [
        { question: "Properties of determinants", subject: "Mathematics", status: "resolved", date: "2025-10-15" },
        { question: "Nernst equation application", subject: "Chemistry", status: "pending", date: "2025-10-14" }
      ]
    },
    activity_score: 80,
    activity_breakdown: {
      live_class_participation: 82,
      ai_video_engagement: 80,
      podcast_listening: 75,
      mcq_practice: 81,
      doubt_clearing: 82
    },
    timetable: [
      { day: 1, subject: "Mathematics", topic: "Determinants and Matrices", start_time: "09:00", end_time: "10:30", instructor: "Dr. Patel", type: "live_class" },
      { day: 1, subject: "Chemistry", topic: "Electrochemistry", start_time: "11:00", end_time: "12:30", instructor: "Prof. Gupta", type: "live_class" },
      { day: 2, subject: "Physics", topic: "Alternating Current", start_time: "09:00", end_time: "10:30", instructor: "Dr. Sharma", type: "live_class" },
      { day: 2, subject: "English", topic: "Poetry and Prose", start_time: "14:00", end_time: "15:00", instructor: "Prof. Nair", type: "live_class" },
      { day: 3, subject: "Mathematics", topic: "Integrals", start_time: "09:00", end_time: "10:30", instructor: "Dr. Patel", type: "live_class" },
      { day: 4, subject: "Chemistry", topic: "Chemical Kinetics", start_time: "11:00", end_time: "12:30", instructor: "Prof. Gupta", type: "live_class" },
      { day: 5, subject: "Physics", topic: "Electromagnetic Waves", start_time: "09:00", end_time: "10:30", instructor: "Dr. Sharma", type: "live_class" }
    ]
  },
  {
    id: "stu-009",
    full_name: "Aditya Verma",
    email: "aditya.verma@email.com",
    phone: "+91-9876543218",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aditya",
    enrollment_date: "2024-05-01",
    last_active: "2025-10-16T10:20:00",
    status: "active",
    courses: [
      {
        id: "course-2",
        name: "Advanced Mathematics",
        subjects: ["Calculus", "Algebra", "Trigonometry"],
        progress: 43,
        enrolled_at: "2024-05-01"
      }
    ],
    total_progress: 43,
    tests_taken: 18,
    avg_test_score: 62,
    ai_queries: 89,
    areas_of_improvement: ["Calculus - Limits and Continuity"],
    followups_pending: 2,
    at_risk: false,
    live_classes: {
      total_scheduled: 38,
      attended: 28,
      attendance_percentage: 74,
      missed: 10,
      upcoming: 3,
      recent_classes: [
        { id: "lc-081", subject: "Calculus", topic: "Definite Integrals", date: "2025-10-15", attended: true, duration_minutes: 90 },
        { id: "lc-082", subject: "Algebra", topic: "Complex Numbers", date: "2025-10-14", attended: false, duration_minutes: 90 },
        { id: "lc-083", subject: "Trigonometry", topic: "Inverse Functions", date: "2025-10-13", attended: true, duration_minutes: 90 },
        { id: "lc-084", subject: "Calculus", topic: "Applications of Derivatives", date: "2025-10-12", attended: true, duration_minutes: 90 },
        { id: "lc-085", subject: "Algebra", topic: "Binomial Theorem", date: "2025-10-11", attended: false, duration_minutes: 90 }
      ]
    },
    ai_video_usage: {
      total_videos: 95,
      watched_count: 58,
      total_watch_time_minutes: 2610,
      completion_rate: 61,
      recent_videos: [
        { title: "Definite Integrals Explained", subject: "Calculus", duration: 45, watched_percentage: 80, date: "2025-10-15" },
        { title: "Complex Number Operations", subject: "Algebra", duration: 40, watched_percentage: 65, date: "2025-10-13" },
        { title: "Inverse Trigonometric Functions", subject: "Trigonometry", duration: 50, watched_percentage: 70, date: "2025-10-12" }
      ]
    },
    podcast_usage: {
      total_listened: 16,
      total_time_minutes: 480,
      favorite_topics: ["Math Shortcuts"],
      recent_podcasts: [
        { title: "Calculus Made Easy", subject: "Calculus", duration: 30, date: "2025-10-14" },
        { title: "Algebra Quick Tips", subject: "Algebra", duration: 28, date: "2025-10-11" }
      ]
    },
    mcq_practice: {
      total_attempted: 180,
      total_correct: 112,
      accuracy_percentage: 62,
      by_subject: {
        Calculus: { attempted: 70, correct: 42, accuracy: 60 },
        Algebra: { attempted: 60, correct: 38, accuracy: 63 },
        Trigonometry: { attempted: 50, correct: 32, accuracy: 64 }
      },
      recent_sessions: [
        { subject: "Calculus", questions: 15, correct: 9, date: "2025-10-15" },
        { subject: "Algebra", questions: 15, correct: 10, date: "2025-10-13" }
      ]
    },
    doubt_clearing: {
      total_doubts: 24,
      resolved: 19,
      pending: 5,
      avg_resolution_time_minutes: 32,
      by_subject: { Calculus: 11, Algebra: 8, Trigonometry: 5 },
      recent_doubts: [
        { question: "How to evaluate definite integrals?", subject: "Calculus", status: "resolved", date: "2025-10-15" },
        { question: "Complex number division", subject: "Algebra", status: "pending", date: "2025-10-13" }
      ]
    },
    activity_score: 68,
    activity_breakdown: {
      live_class_participation: 74,
      ai_video_engagement: 61,
      podcast_listening: 60,
      mcq_practice: 65,
      doubt_clearing: 70
    },
    timetable: [
      { day: 1, subject: "Calculus", topic: "Integrals", start_time: "09:00", end_time: "10:30", instructor: "Dr. Patel", type: "live_class" },
      { day: 2, subject: "Algebra", topic: "Complex Numbers", start_time: "11:00", end_time: "12:30", instructor: "Dr. Patel", type: "live_class" },
      { day: 3, subject: "Trigonometry", topic: "Inverse Functions", start_time: "09:00", end_time: "10:30", instructor: "Dr. Patel", type: "live_class" },
      { day: 4, subject: "Calculus", topic: "Applications", start_time: "09:00", end_time: "10:30", instructor: "Dr. Patel", type: "live_class" },
      { day: 5, subject: "Algebra", topic: "Binomial Theorem", start_time: "11:00", end_time: "12:30", instructor: "Dr. Patel", type: "live_class" }
    ]
  },
  {
    id: "stu-010",
    full_name: "Neha Kapoor",
    email: "neha.kapoor@email.com",
    phone: "+91-9876543219",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Neha",
    enrollment_date: "2024-01-20",
    last_active: "2025-10-16T15:10:00",
    status: "active",
    courses: [
      {
        id: "course-3",
        name: "NEET 2025 Biology",
        subjects: ["Biology", "Chemistry", "Physics"],
        progress: 84,
        enrolled_at: "2024-01-20"
      },
      {
        id: "course-4",
        name: "Class 12 Board Prep",
        subjects: ["Mathematics", "Physics", "Chemistry", "English"],
        progress: 79,
        enrolled_at: "2024-01-25"
      }
    ],
    total_progress: 81.5,
    tests_taken: 58,
    avg_test_score: 85,
    ai_queries: 267,
    areas_of_improvement: ["Physics - Optics"],
    followups_pending: 0,
    at_risk: false,
    live_classes: {
      total_scheduled: 60,
      attended: 52,
      attendance_percentage: 87,
      missed: 8,
      upcoming: 5,
      recent_classes: [
        { id: "lc-091", subject: "Biology", topic: "Reproduction", date: "2025-10-15", attended: true, duration_minutes: 90 },
        { id: "lc-092", subject: "Chemistry", topic: "Aldehydes and Ketones", date: "2025-10-14", attended: true, duration_minutes: 90 },
        { id: "lc-093", subject: "Physics", topic: "Wave Optics", date: "2025-10-13", attended: false, duration_minutes: 90 },
        { id: "lc-094", subject: "Mathematics", topic: "Probability", date: "2025-10-12", attended: true, duration_minutes: 90 },
        { id: "lc-095", subject: "Biology", topic: "Biotechnology", date: "2025-10-11", attended: true, duration_minutes: 90 }
      ]
    },
    ai_video_usage: {
      total_videos: 160,
      watched_count: 140,
      total_watch_time_minutes: 6300,
      completion_rate: 88,
      recent_videos: [
        { title: "Human Reproduction System", subject: "Biology", duration: 55, watched_percentage: 100, date: "2025-10-15" },
        { title: "Carbonyl Compounds", subject: "Chemistry", duration: 50, watched_percentage: 95, date: "2025-10-14" },
        { title: "Wave Optics Interference", subject: "Physics", duration: 45, watched_percentage: 85, date: "2025-10-13" }
      ]
    },
    podcast_usage: {
      total_listened: 41,
      total_time_minutes: 1230,
      favorite_topics: ["NEET Preparation", "Biology Concepts"],
      recent_podcasts: [
        { title: "NEET Biology Mastery", subject: "Biology", duration: 30, date: "2025-10-15" },
        { title: "Organic Chemistry Tricks", subject: "Chemistry", duration: 28, date: "2025-10-13" }
      ]
    },
    mcq_practice: {
      total_attempted: 580,
      total_correct: 493,
      accuracy_percentage: 85,
      by_subject: {
        Biology: { attempted: 200, correct: 176, accuracy: 88 },
        Chemistry: { attempted: 150, correct: 128, accuracy: 85 },
        Physics: { attempted: 130, correct: 104, accuracy: 80 },
        Mathematics: { attempted: 100, correct: 85, accuracy: 85 }
      },
      recent_sessions: [
        { subject: "Biology", questions: 25, correct: 22, date: "2025-10-15" },
        { subject: "Chemistry", questions: 20, correct: 17, date: "2025-10-14" }
      ]
    },
    doubt_clearing: {
      total_doubts: 38,
      resolved: 36,
      pending: 2,
      avg_resolution_time_minutes: 20,
      by_subject: { Biology: 16, Chemistry: 12, Physics: 8, Mathematics: 2 },
      recent_doubts: [
        { question: "Gametogenesis process", subject: "Biology", status: "resolved", date: "2025-10-15" },
        { question: "Aldol condensation mechanism", subject: "Chemistry", status: "resolved", date: "2025-10-14" }
      ]
    },
    activity_score: 88,
    activity_breakdown: {
      live_class_participation: 87,
      ai_video_engagement: 88,
      podcast_listening: 85,
      mcq_practice: 90,
      doubt_clearing: 90
    },
    timetable: [
      { day: 1, subject: "Biology", topic: "Reproduction", start_time: "09:00", end_time: "10:30", instructor: "Dr. Mehta", type: "live_class" },
      { day: 1, subject: "Chemistry", topic: "Organic Compounds", start_time: "11:00", end_time: "12:30", instructor: "Prof. Gupta", type: "live_class" },
      { day: 2, subject: "Physics", topic: "Wave Optics", start_time: "09:00", end_time: "10:30", instructor: "Dr. Sharma", type: "live_class" },
      { day: 2, subject: "Mathematics", topic: "Probability", start_time: "14:00", end_time: "15:30", instructor: "Dr. Patel", type: "live_class" },
      { day: 3, subject: "Biology", topic: "Biotechnology", start_time: "09:00", end_time: "10:30", instructor: "Dr. Mehta", type: "live_class" },
      { day: 4, subject: "Chemistry", topic: "Coordination Compounds", start_time: "11:00", end_time: "12:30", instructor: "Prof. Gupta", type: "live_class" },
      { day: 5, subject: "Physics", topic: "Dual Nature of Matter", start_time: "09:00", end_time: "10:30", instructor: "Dr. Sharma", type: "live_class" }
    ]
  }
];

// Enhanced progress data for all students
export const mockProgressData: Record<string, any> = {
  "stu-001": {
    overall_progress_timeline: [
      { date: "2024-01", progress: 5 },
      { date: "2024-02", progress: 15 },
      { date: "2024-03", progress: 28 },
      { date: "2024-04", progress: 38 },
      { date: "2024-05", progress: 48 },
      { date: "2024-06", progress: 55 },
      { date: "2024-07", progress: 62 },
      { date: "2024-08", progress: 67 },
      { date: "2024-09", progress: 71 },
      { date: "2024-10", progress: 74.5 }
    ],
    subject_performance: {
      "Physics": 72,
      "Chemistry": 58,
      "Mathematics": 85,
      "Calculus": 80,
      "Algebra": 88,
      "Trigonometry": 78
    },
    chapter_completion: [
      { chapter: "Mechanics", subject: "Physics", course: "JEE Main 2025 Complete", completed: true, score: 85, progress: 100 },
      { chapter: "Thermodynamics", subject: "Physics", course: "JEE Main 2025 Complete", completed: true, score: 78, progress: 100 },
      { chapter: "Optics", subject: "Physics", course: "JEE Main 2025 Complete", completed: false, score: null, progress: 45 },
      { chapter: "Organic Chemistry", subject: "Chemistry", course: "JEE Main 2025 Complete", completed: false, score: 52, progress: 70 },
      { chapter: "Inorganic Chemistry", subject: "Chemistry", course: "JEE Main 2025 Complete", completed: true, score: 68, progress: 100 },
      { chapter: "Calculus Basics", subject: "Calculus", course: "Advanced Mathematics", completed: true, score: 92, progress: 100 },
      { chapter: "Algebra Fundamentals", subject: "Algebra", course: "Advanced Mathematics", completed: true, score: 88, progress: 100 },
      { chapter: "Trigonometric Functions", subject: "Trigonometry", course: "Advanced Mathematics", completed: false, score: null, progress: 65 }
    ],
    time_distribution: {
      "Physics": 35,
      "Chemistry": 28,
      "Mathematics": 37
    }
  },
  "stu-002": {
    overall_progress_timeline: [
      { date: "2024-02", progress: 10 },
      { date: "2024-03", progress: 25 },
      { date: "2024-04", progress: 42 },
      { date: "2024-05", progress: 55 },
      { date: "2024-06", progress: 65 },
      { date: "2024-07", progress: 73 },
      { date: "2024-08", progress: 80 },
      { date: "2024-09", progress: 85 },
      { date: "2024-10", progress: 89 }
    ],
    subject_performance: {
      "Biology": 95,
      "Chemistry": 88,
      "Physics": 84
    },
    chapter_completion: [
      { chapter: "Cell Biology", subject: "Biology", course: "NEET 2025 Biology", completed: true, score: 96, progress: 100 },
      { chapter: "Genetics", subject: "Biology", course: "NEET 2025 Biology", completed: true, score: 94, progress: 100 },
      { chapter: "Ecology", subject: "Biology", course: "NEET 2025 Biology", completed: true, score: 95, progress: 100 },
      { chapter: "Human Physiology", subject: "Biology", course: "NEET 2025 Biology", completed: false, score: null, progress: 85 },
      { chapter: "Organic Chemistry", subject: "Chemistry", course: "NEET 2025 Biology", completed: true, score: 90, progress: 100 },
      { chapter: "Physical Chemistry", subject: "Chemistry", course: "NEET 2025 Biology", completed: true, score: 86, progress: 100 },
      { chapter: "Modern Physics", subject: "Physics", course: "NEET 2025 Biology", completed: true, score: 88, progress: 100 },
      { chapter: "Electromagnetism", subject: "Physics", course: "NEET 2025 Biology", completed: false, score: null, progress: 75 }
    ],
    time_distribution: {
      "Biology": 45,
      "Chemistry": 30,
      "Physics": 25
    }
  },
  "stu-003": {
    overall_progress_timeline: [
      { date: "2024-03", progress: 5 },
      { date: "2024-04", progress: 8 },
      { date: "2024-05", progress: 12 },
      { date: "2024-06", progress: 16 },
      { date: "2024-07", progress: 20 },
      { date: "2024-08", progress: 24 },
      { date: "2024-09", progress: 29 },
      { date: "2024-10", progress: 34 }
    ],
    subject_performance: {
      "Physics": 35,
      "Chemistry": 32,
      "Mathematics": 36
    },
    chapter_completion: [
      { chapter: "Mechanics", subject: "Physics", course: "JEE Main 2025 Complete", completed: false, score: null, progress: 25 },
      { chapter: "Kinematics", subject: "Physics", course: "JEE Main 2025 Complete", completed: false, score: 45, progress: 60 },
      { chapter: "Atomic Structure", subject: "Chemistry", course: "JEE Main 2025 Complete", completed: false, score: null, progress: 30 },
      { chapter: "Chemical Bonding", subject: "Chemistry", course: "JEE Main 2025 Complete", completed: false, score: 42, progress: 55 },
      { chapter: "Functions", subject: "Mathematics", course: "JEE Main 2025 Complete", completed: false, score: null, progress: 40 },
      { chapter: "Trigonometry Basics", subject: "Mathematics", course: "JEE Main 2025 Complete", completed: false, score: 48, progress: 50 }
    ],
    time_distribution: {
      "Physics": 32,
      "Chemistry": 30,
      "Mathematics": 38
    }
  },
  "stu-004": {
    overall_progress_timeline: [
      { date: "2024-01", progress: 8 },
      { date: "2024-02", progress: 18 },
      { date: "2024-03", progress: 30 },
      { date: "2024-04", progress: 42 },
      { date: "2024-05", progress: 52 },
      { date: "2024-06", progress: 60 },
      { date: "2024-07", progress: 66 },
      { date: "2024-08", progress: 70 },
      { date: "2024-09", progress: 72 },
      { date: "2024-10", progress: 74.5 }
    ],
    subject_performance: {
      "Mathematics": 85,
      "Physics": 78,
      "Chemistry": 68,
      "English": 78
    },
    chapter_completion: [
      { chapter: "Differential Equations", subject: "Mathematics", course: "Class 12 Board Prep", completed: true, score: 88, progress: 100 },
      { chapter: "Probability", subject: "Mathematics", course: "Class 12 Board Prep", completed: true, score: 82, progress: 100 },
      { chapter: "Matrices", subject: "Mathematics", course: "JEE Main 2025 Complete", completed: false, score: null, progress: 70 },
      { chapter: "Semiconductor Devices", subject: "Physics", course: "Class 12 Board Prep", completed: true, score: 80, progress: 100 },
      { chapter: "Communication Systems", subject: "Physics", course: "Class 12 Board Prep", completed: false, score: null, progress: 65 },
      { chapter: "Coordination Compounds", subject: "Chemistry", course: "Class 12 Board Prep", completed: false, score: 65, progress: 75 },
      { chapter: "Polymers", subject: "Chemistry", course: "Class 12 Board Prep", completed: true, score: 72, progress: 100 },
      { chapter: "Poetry Analysis", subject: "English", course: "Class 12 Board Prep", completed: true, score: 78, progress: 100 }
    ],
    time_distribution: {
      "Mathematics": 32,
      "Physics": 28,
      "Chemistry": 25,
      "English": 15
    }
  },
  "stu-005": {
    overall_progress_timeline: [
      { date: "2024-04", progress: 3 },
      { date: "2024-05", progress: 5 },
      { date: "2024-06", progress: 8 },
      { date: "2024-07", progress: 10 },
      { date: "2024-08", progress: 12 },
      { date: "2024-09", progress: 15 },
      { date: "2024-10", progress: 18 }
    ],
    subject_performance: {
      "Calculus": 20,
      "Algebra": 18,
      "Trigonometry": 16
    },
    chapter_completion: [
      { chapter: "Limits", subject: "Calculus", course: "Advanced Mathematics", completed: false, score: null, progress: 20 },
      { chapter: "Continuity", subject: "Calculus", course: "Advanced Mathematics", completed: false, score: 48, progress: 35 },
      { chapter: "Polynomials", subject: "Algebra", course: "Advanced Mathematics", completed: false, score: null, progress: 18 },
      { chapter: "Quadratic Equations", subject: "Algebra", course: "Advanced Mathematics", completed: false, score: 52, progress: 40 },
      { chapter: "Trigonometric Identities", subject: "Trigonometry", course: "Advanced Mathematics", completed: false, score: null, progress: 15 }
    ],
    time_distribution: {
      "Calculus": 35,
      "Algebra": 38,
      "Trigonometry": 27
    }
  },
  "stu-006": {
    overall_progress_timeline: [
      { date: "2023-12", progress: 12 },
      { date: "2024-01", progress: 28 },
      { date: "2024-02", progress: 42 },
      { date: "2024-03", progress: 55 },
      { date: "2024-04", progress: 65 },
      { date: "2024-05", progress: 74 },
      { date: "2024-06", progress: 81 },
      { date: "2024-07", progress: 86 },
      { date: "2024-08", progress: 90 },
      { date: "2024-09", progress: 93 },
      { date: "2024-10", progress: 95 }
    ],
    subject_performance: {
      "Biology": 97,
      "Chemistry": 94,
      "Physics": 93
    },
    chapter_completion: [
      { chapter: "Human Physiology", subject: "Biology", course: "NEET 2025 Biology", completed: true, score: 98, progress: 100 },
      { chapter: "Plant Physiology", subject: "Biology", course: "NEET 2025 Biology", completed: true, score: 96, progress: 100 },
      { chapter: "Genetics and Evolution", subject: "Biology", course: "NEET 2025 Biology", completed: true, score: 97, progress: 100 },
      { chapter: "Ecology and Environment", subject: "Biology", course: "NEET 2025 Biology", completed: false, score: null, progress: 90 },
      { chapter: "Biomolecules", subject: "Chemistry", course: "NEET 2025 Biology", completed: true, score: 95, progress: 100 },
      { chapter: "Organic Compounds", subject: "Chemistry", course: "NEET 2025 Biology", completed: true, score: 93, progress: 100 },
      { chapter: "Ray Optics", subject: "Physics", course: "NEET 2025 Biology", completed: true, score: 92, progress: 100 },
      { chapter: "Modern Physics", subject: "Physics", course: "NEET 2025 Biology", completed: false, score: null, progress: 88 }
    ],
    time_distribution: {
      "Biology": 48,
      "Chemistry": 28,
      "Physics": 24
    }
  },
  "stu-007": {
    overall_progress_timeline: [
      { date: "2024-02", progress: 5 },
      { date: "2024-03", progress: 12 },
      { date: "2024-04", progress: 22 },
      { date: "2024-05", progress: 30 },
      { date: "2024-06", progress: 37 },
      { date: "2024-07", progress: 43 },
      { date: "2024-08", progress: 48 },
      { date: "2024-09", progress: 52 },
      { date: "2024-10", progress: 56 }
    ],
    subject_performance: {
      "Physics": 65,
      "Chemistry": 52,
      "Mathematics": 52
    },
    chapter_completion: [
      { chapter: "Modern Physics", subject: "Physics", course: "JEE Main 2025 Complete", completed: false, score: 70, progress: 80 },
      { chapter: "Atomic Structure", subject: "Physics", course: "JEE Main 2025 Complete", completed: false, score: null, progress: 65 },
      { chapter: "Nuclear Physics", subject: "Physics", course: "JEE Main 2025 Complete", completed: false, score: 68, progress: 75 },
      { chapter: "Solutions", subject: "Chemistry", course: "JEE Main 2025 Complete", completed: false, score: 58, progress: 70 },
      { chapter: "Electrochemistry", subject: "Chemistry", course: "JEE Main 2025 Complete", completed: false, score: null, progress: 55 },
      { chapter: "3D Geometry", subject: "Mathematics", course: "JEE Main 2025 Complete", completed: false, score: 65, progress: 72 },
      { chapter: "Vectors", subject: "Mathematics", course: "JEE Main 2025 Complete", completed: false, score: null, progress: 60 }
    ],
    time_distribution: {
      "Physics": 38,
      "Chemistry": 30,
      "Mathematics": 32
    }
  },
  "stu-008": {
    overall_progress_timeline: [
      { date: "2024-03", progress: 8 },
      { date: "2024-04", progress: 18 },
      { date: "2024-05", progress: 28 },
      { date: "2024-06", progress: 38 },
      { date: "2024-07", progress: 48 },
      { date: "2024-08", progress: 56 },
      { date: "2024-09", progress: 64 },
      { date: "2024-10", progress: 72 }
    ],
    subject_performance: {
      "Mathematics": 80,
      "Physics": 75,
      "Chemistry": 68,
      "English": 74
    },
    chapter_completion: [
      { chapter: "Determinants", subject: "Mathematics", course: "Class 12 Board Prep", completed: true, score: 82, progress: 100 },
      { chapter: "Matrices", subject: "Mathematics", course: "Class 12 Board Prep", completed: true, score: 78, progress: 100 },
      { chapter: "Integrals", subject: "Mathematics", course: "Class 12 Board Prep", completed: false, score: null, progress: 70 },
      { chapter: "Alternating Current", subject: "Physics", course: "Class 12 Board Prep", completed: false, score: 72, progress: 75 },
      { chapter: "Electromagnetic Waves", subject: "Physics", course: "Class 12 Board Prep", completed: false, score: null, progress: 65 },
      { chapter: "Electrochemistry", subject: "Chemistry", course: "Class 12 Board Prep", completed: false, score: 65, progress: 70 },
      { chapter: "Chemical Kinetics", subject: "Chemistry", course: "Class 12 Board Prep", completed: false, score: null, progress: 62 },
      { chapter: "Poetry and Prose", subject: "English", course: "Class 12 Board Prep", completed: true, score: 74, progress: 100 }
    ],
    time_distribution: {
      "Mathematics": 35,
      "Physics": 28,
      "Chemistry": 23,
      "English": 14
    }
  },
  "stu-009": {
    overall_progress_timeline: [
      { date: "2024-05", progress: 5 },
      { date: "2024-06", progress: 12 },
      { date: "2024-07", progress: 20 },
      { date: "2024-08", progress: 28 },
      { date: "2024-09", progress: 36 },
      { date: "2024-10", progress: 43 }
    ],
    subject_performance: {
      "Calculus": 50,
      "Algebra": 45,
      "Trigonometry": 34
    },
    chapter_completion: [
      { chapter: "Definite Integrals", subject: "Calculus", course: "Advanced Mathematics", completed: false, score: 62, progress: 75 },
      { chapter: "Applications of Derivatives", subject: "Calculus", course: "Advanced Mathematics", completed: false, score: null, progress: 60 },
      { chapter: "Limits and Continuity", subject: "Calculus", course: "Advanced Mathematics", completed: false, score: 58, progress: 68 },
      { chapter: "Complex Numbers", subject: "Algebra", course: "Advanced Mathematics", completed: false, score: null, progress: 55 },
      { chapter: "Binomial Theorem", subject: "Algebra", course: "Advanced Mathematics", completed: false, score: 60, progress: 70 },
      { chapter: "Inverse Functions", subject: "Trigonometry", course: "Advanced Mathematics", completed: false, score: null, progress: 40 }
    ],
    time_distribution: {
      "Calculus": 42,
      "Algebra": 35,
      "Trigonometry": 23
    }
  },
  "stu-010": {
    overall_progress_timeline: [
      { date: "2024-01", progress: 10 },
      { date: "2024-02", progress: 22 },
      { date: "2024-03", progress: 35 },
      { date: "2024-04", progress: 48 },
      { date: "2024-05", progress: 58 },
      { date: "2024-06", progress: 66 },
      { date: "2024-07", progress: 72 },
      { date: "2024-08", progress: 76 },
      { date: "2024-09", progress: 79 },
      { date: "2024-10", progress: 81.5 }
    ],
    subject_performance: {
      "Biology": 88,
      "Chemistry": 82,
      "Physics": 76,
      "Mathematics": 80
    },
    chapter_completion: [
      { chapter: "Reproduction", subject: "Biology", course: "NEET 2025 Biology", completed: false, score: null, progress: 85 },
      { chapter: "Biotechnology", subject: "Biology", course: "NEET 2025 Biology", completed: true, score: 90, progress: 100 },
      { chapter: "Human Health", subject: "Biology", course: "NEET 2025 Biology", completed: true, score: 86, progress: 100 },
      { chapter: "Aldehydes and Ketones", subject: "Chemistry", course: "NEET 2025 Biology", completed: false, score: 78, progress: 80 },
      { chapter: "Coordination Compounds", subject: "Chemistry", course: "Class 12 Board Prep", completed: true, score: 85, progress: 100 },
      { chapter: "Wave Optics", subject: "Physics", course: "NEET 2025 Biology", completed: false, score: 72, progress: 75 },
      { chapter: "Dual Nature of Matter", subject: "Physics", course: "NEET 2025 Biology", completed: false, score: null, progress: 68 },
      { chapter: "Probability", subject: "Mathematics", course: "Class 12 Board Prep", completed: true, score: 82, progress: 100 }
    ],
    time_distribution: {
      "Biology": 38,
      "Chemistry": 26,
      "Physics": 22,
      "Mathematics": 14
    }
  }
};

// Enhanced test history for all students
export const mockTestHistory: Record<string, any> = {
  "stu-001": {
    dpt: {
      streak: 12,
      total_tests: 45,
      average_score: 78,
      weekly_scores: [72, 75, 80, 78, 82, 85, 77],
      calendar_data: Array.from({ length: 90 }, (_, i) => ({
        date: new Date(Date.now() - (89 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        count: Math.random() > 0.3 ? Math.floor(Math.random() * 3) + 1 : 0
      }))
    },
    assignments: [
      { id: "asg-1", title: "Physics - Mechanics", course: "JEE Main 2025 Complete", subject: "Physics", score: 85, total: 100, submitted_at: "2025-10-10", status: "graded", percentage: 85 },
      { id: "asg-2", title: "Chemistry - Organic Reactions", course: "JEE Main 2025 Complete", subject: "Chemistry", score: 52, total: 100, submitted_at: "2025-10-08", status: "graded", percentage: 52 },
      { id: "asg-3", title: "Mathematics - Calculus", course: "Advanced Mathematics", subject: "Calculus", score: 92, total: 100, submitted_at: "2025-10-05", status: "graded", percentage: 92 },
      { id: "asg-4", title: "Physics - Thermodynamics", course: "JEE Main 2025 Complete", subject: "Physics", score: 78, total: 100, submitted_at: "2025-10-01", status: "graded", percentage: 78 }
    ],
    quizzes: [
      { id: "quiz-1", title: "Weekly Physics Quiz", subject: "Physics", score: 18, total: 20, date: "2025-10-12" },
      { id: "quiz-2", title: "Chemistry Mock Test", subject: "Chemistry", score: 42, total: 50, date: "2025-10-09" },
      { id: "quiz-3", title: "Math Speed Test", subject: "Mathematics", score: 28, total: 30, date: "2025-10-06" }
    ]
  },
  "stu-002": {
    dpt: {
      streak: 28,
      total_tests: 67,
      average_score: 92,
      weekly_scores: [90, 92, 94, 91, 93, 95, 92],
      calendar_data: Array.from({ length: 90 }, (_, i) => ({
        date: new Date(Date.now() - (89 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        count: Math.random() > 0.1 ? Math.floor(Math.random() * 2) + 2 : 0
      }))
    },
    assignments: [
      { id: "asg-11", title: "Biology - Cell Biology", course: "NEET 2025 Biology", subject: "Biology", score: 96, total: 100, submitted_at: "2025-10-11", status: "graded", percentage: 96 },
      { id: "asg-12", title: "Chemistry - Equilibrium", course: "NEET 2025 Biology", subject: "Chemistry", score: 90, total: 100, submitted_at: "2025-10-09", status: "graded", percentage: 90 },
      { id: "asg-13", title: "Physics - Electromagnetism", course: "NEET 2025 Biology", subject: "Physics", score: 88, total: 100, submitted_at: "2025-10-06", status: "graded", percentage: 88 },
      { id: "asg-14", title: "Biology - Genetics", course: "NEET 2025 Biology", subject: "Biology", score: 94, total: 100, submitted_at: "2025-10-03", status: "graded", percentage: 94 }
    ],
    quizzes: [
      { id: "quiz-11", title: "Biology Weekly Test", subject: "Biology", score: 48, total: 50, date: "2025-10-13" },
      { id: "quiz-12", title: "Chemistry Practice", subject: "Chemistry", score: 44, total: 50, date: "2025-10-10" },
      { id: "quiz-13", title: "Physics Quick Quiz", subject: "Physics", score: 38, total: 40, date: "2025-10-07" }
    ]
  },
  "stu-003": {
    dpt: {
      streak: 0,
      total_tests: 12,
      average_score: 45,
      weekly_scores: [42, 0, 48, 0, 45, 0, 43],
      calendar_data: Array.from({ length: 90 }, (_, i) => ({
        date: new Date(Date.now() - (89 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        count: Math.random() > 0.7 ? 1 : 0
      }))
    },
    assignments: [
      { id: "asg-21", title: "Physics - Kinematics", course: "JEE Main 2025 Complete", subject: "Physics", score: 45, total: 100, submitted_at: "2025-10-09", status: "graded", percentage: 45 },
      { id: "asg-22", title: "Chemistry - Bonding", course: "JEE Main 2025 Complete", subject: "Chemistry", score: 42, total: 100, submitted_at: "2025-10-04", status: "graded", percentage: 42 },
      { id: "asg-23", title: "Mathematics - Functions", course: "JEE Main 2025 Complete", subject: "Mathematics", score: 48, total: 100, submitted_at: "2025-09-28", status: "graded", percentage: 48 }
    ],
    quizzes: [
      { id: "quiz-21", title: "Physics Quiz", subject: "Physics", score: 9, total: 20, date: "2025-10-11" },
      { id: "quiz-22", title: "Math Quiz", subject: "Mathematics", score: 11, total: 20, date: "2025-10-05" }
    ]
  },
  "stu-004": {
    dpt: {
      streak: 15,
      total_tests: 52,
      average_score: 81,
      weekly_scores: [78, 80, 82, 79, 84, 83, 81],
      calendar_data: Array.from({ length: 90 }, (_, i) => ({
        date: new Date(Date.now() - (89 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        count: Math.random() > 0.25 ? Math.floor(Math.random() * 3) + 1 : 0
      }))
    },
    assignments: [
      { id: "asg-31", title: "Math - Differential Equations", course: "Class 12 Board Prep", subject: "Mathematics", score: 88, total: 100, submitted_at: "2025-10-12", status: "graded", percentage: 88 },
      { id: "asg-32", title: "Physics - Semiconductors", course: "Class 12 Board Prep", subject: "Physics", score: 80, total: 100, submitted_at: "2025-10-10", status: "graded", percentage: 80 },
      { id: "asg-33", title: "Chemistry - Coordination", course: "Class 12 Board Prep", subject: "Chemistry", score: 72, total: 100, submitted_at: "2025-10-07", status: "graded", percentage: 72 },
      { id: "asg-34", title: "English - Essay Writing", course: "Class 12 Board Prep", subject: "English", score: 78, total: 100, submitted_at: "2025-10-04", status: "graded", percentage: 78 }
    ],
    quizzes: [
      { id: "quiz-31", title: "Math Quick Test", subject: "Mathematics", score: 42, total: 50, date: "2025-10-13" },
      { id: "quiz-32", title: "Physics Quiz", subject: "Physics", score: 35, total: 50, date: "2025-10-11" },
      { id: "quiz-33", title: "Chemistry Test", subject: "Chemistry", score: 32, total: 50, date: "2025-10-08" }
    ]
  },
  "stu-005": {
    dpt: {
      streak: 0,
      total_tests: 5,
      average_score: 52,
      weekly_scores: [0, 0, 52, 0, 0, 0, 0],
      calendar_data: Array.from({ length: 90 }, (_, i) => ({
        date: new Date(Date.now() - (89 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        count: Math.random() > 0.9 ? 1 : 0
      }))
    },
    assignments: [
      { id: "asg-41", title: "Calculus - Limits", course: "Advanced Mathematics", subject: "Calculus", score: 48, total: 100, submitted_at: "2025-09-20", status: "graded", percentage: 48 },
      { id: "asg-42", title: "Algebra - Polynomials", course: "Advanced Mathematics", subject: "Algebra", score: 52, total: 100, submitted_at: "2025-09-15", status: "graded", percentage: 52 }
    ],
    quizzes: [
      { id: "quiz-41", title: "Calculus Quiz", subject: "Calculus", score: 10, total: 20, date: "2025-10-05" }
    ]
  },
  "stu-006": {
    dpt: {
      streak: 42,
      total_tests: 89,
      average_score: 94,
      weekly_scores: [93, 94, 96, 95, 93, 94, 95],
      calendar_data: Array.from({ length: 90 }, (_, i) => ({
        date: new Date(Date.now() - (89 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        count: Math.random() > 0.05 ? Math.floor(Math.random() * 2) + 2 : 1
      }))
    },
    assignments: [
      { id: "asg-51", title: "Biology - Human Physiology", course: "NEET 2025 Biology", subject: "Biology", score: 98, total: 100, submitted_at: "2025-10-13", status: "graded", percentage: 98 },
      { id: "asg-52", title: "Chemistry - Biomolecules", course: "NEET 2025 Biology", subject: "Chemistry", score: 95, total: 100, submitted_at: "2025-10-11", status: "graded", percentage: 95 },
      { id: "asg-53", title: "Physics - Ray Optics", course: "NEET 2025 Biology", subject: "Physics", score: 92, total: 100, submitted_at: "2025-10-09", status: "graded", percentage: 92 },
      { id: "asg-54", title: "Biology - Plant Physiology", course: "NEET 2025 Biology", subject: "Biology", score: 96, total: 100, submitted_at: "2025-10-06", status: "graded", percentage: 96 }
    ],
    quizzes: [
      { id: "quiz-51", title: "Biology Master Quiz", subject: "Biology", score: 49, total: 50, date: "2025-10-14" },
      { id: "quiz-52", title: "Chemistry Test", subject: "Chemistry", score: 47, total: 50, date: "2025-10-12" },
      { id: "quiz-53", title: "Physics Quiz", subject: "Physics", score: 45, total: 50, date: "2025-10-10" }
    ]
  },
  "stu-007": {
    dpt: {
      streak: 8,
      total_tests: 32,
      average_score: 68,
      weekly_scores: [65, 68, 70, 67, 69, 72, 66],
      calendar_data: Array.from({ length: 90 }, (_, i) => ({
        date: new Date(Date.now() - (89 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        count: Math.random() > 0.4 ? Math.floor(Math.random() * 2) + 1 : 0
      }))
    },
    assignments: [
      { id: "asg-61", title: "Physics - Modern Physics", course: "JEE Main 2025 Complete", subject: "Physics", score: 70, total: 100, submitted_at: "2025-10-12", status: "graded", percentage: 70 },
      { id: "asg-62", title: "Chemistry - Solutions", course: "JEE Main 2025 Complete", subject: "Chemistry", score: 58, total: 100, submitted_at: "2025-10-09", status: "graded", percentage: 58 },
      { id: "asg-63", title: "Math - 3D Geometry", course: "JEE Main 2025 Complete", subject: "Mathematics", score: 65, total: 100, submitted_at: "2025-10-06", status: "graded", percentage: 65 },
      { id: "asg-64", title: "Physics - Nuclear Physics", course: "JEE Main 2025 Complete", subject: "Physics", score: 68, total: 100, submitted_at: "2025-10-03", status: "graded", percentage: 68 }
    ],
    quizzes: [
      { id: "quiz-61", title: "Physics Quiz", subject: "Physics", score: 28, total: 40, date: "2025-10-13" },
      { id: "quiz-62", title: "Math Test", subject: "Mathematics", score: 32, total: 50, date: "2025-10-10" },
      { id: "quiz-63", title: "Chemistry Quiz", subject: "Chemistry", score: 26, total: 40, date: "2025-10-07" }
    ]
  },
  "stu-008": {
    dpt: {
      streak: 11,
      total_tests: 41,
      average_score: 76,
      weekly_scores: [74, 76, 78, 75, 77, 79, 75],
      calendar_data: Array.from({ length: 90 }, (_, i) => ({
        date: new Date(Date.now() - (89 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        count: Math.random() > 0.35 ? Math.floor(Math.random() * 2) + 1 : 0
      }))
    },
    assignments: [
      { id: "asg-71", title: "Math - Determinants", course: "Class 12 Board Prep", subject: "Mathematics", score: 82, total: 100, submitted_at: "2025-10-12", status: "graded", percentage: 82 },
      { id: "asg-72", title: "Chemistry - Electrochemistry", course: "Class 12 Board Prep", subject: "Chemistry", score: 65, total: 100, submitted_at: "2025-10-10", status: "graded", percentage: 65 },
      { id: "asg-73", title: "Physics - AC Circuits", course: "Class 12 Board Prep", subject: "Physics", score: 72, total: 100, submitted_at: "2025-10-07", status: "graded", percentage: 72 },
      { id: "asg-74", title: "Math - Matrices", course: "Class 12 Board Prep", subject: "Mathematics", score: 78, total: 100, submitted_at: "2025-10-04", status: "graded", percentage: 78 }
    ],
    quizzes: [
      { id: "quiz-71", title: "Math Quiz", subject: "Mathematics", score: 38, total: 50, date: "2025-10-13" },
      { id: "quiz-72", title: "Physics Test", subject: "Physics", score: 34, total: 50, date: "2025-10-11" },
      { id: "quiz-73", title: "Chemistry Quiz", subject: "Chemistry", score: 30, total: 50, date: "2025-10-08" }
    ]
  },
  "stu-009": {
    dpt: {
      streak: 5,
      total_tests: 18,
      average_score: 62,
      weekly_scores: [60, 0, 62, 65, 0, 60, 63],
      calendar_data: Array.from({ length: 90 }, (_, i) => ({
        date: new Date(Date.now() - (89 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        count: Math.random() > 0.6 ? Math.floor(Math.random() * 2) : 0
      }))
    },
    assignments: [
      { id: "asg-81", title: "Calculus - Integrals", course: "Advanced Mathematics", subject: "Calculus", score: 62, total: 100, submitted_at: "2025-10-11", status: "graded", percentage: 62 },
      { id: "asg-82", title: "Algebra - Complex Numbers", course: "Advanced Mathematics", subject: "Algebra", score: 60, total: 100, submitted_at: "2025-10-08", status: "graded", percentage: 60 },
      { id: "asg-83", title: "Calculus - Applications", course: "Advanced Mathematics", subject: "Calculus", score: 58, total: 100, submitted_at: "2025-10-04", status: "graded", percentage: 58 }
    ],
    quizzes: [
      { id: "quiz-81", title: "Calculus Quiz", subject: "Calculus", score: 24, total: 40, date: "2025-10-12" },
      { id: "quiz-82", title: "Algebra Test", subject: "Algebra", score: 28, total: 50, date: "2025-10-09" }
    ]
  },
  "stu-010": {
    dpt: {
      streak: 22,
      total_tests: 58,
      average_score: 85,
      weekly_scores: [83, 85, 87, 84, 86, 88, 85],
      calendar_data: Array.from({ length: 90 }, (_, i) => ({
        date: new Date(Date.now() - (89 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        count: Math.random() > 0.2 ? Math.floor(Math.random() * 2) + 1 : 0
      }))
    },
    assignments: [
      { id: "asg-91", title: "Biology - Reproduction", course: "NEET 2025 Biology", subject: "Biology", score: 90, total: 100, submitted_at: "2025-10-13", status: "graded", percentage: 90 },
      { id: "asg-92", title: "Chemistry - Aldehydes", course: "NEET 2025 Biology", subject: "Chemistry", score: 82, total: 100, submitted_at: "2025-10-11", status: "graded", percentage: 82 },
      { id: "asg-93", title: "Physics - Wave Optics", course: "NEET 2025 Biology", subject: "Physics", score: 78, total: 100, submitted_at: "2025-10-09", status: "graded", percentage: 78 },
      { id: "asg-94", title: "Math - Probability", course: "Class 12 Board Prep", subject: "Mathematics", score: 85, total: 100, submitted_at: "2025-10-07", status: "graded", percentage: 85 }
    ],
    quizzes: [
      { id: "quiz-91", title: "Biology Weekly", subject: "Biology", score: 44, total: 50, date: "2025-10-14" },
      { id: "quiz-92", title: "Chemistry Test", subject: "Chemistry", score: 40, total: 50, date: "2025-10-12" },
      { id: "quiz-93", title: "Physics Quiz", subject: "Physics", score: 36, total: 50, date: "2025-10-10" }
    ]
  }
};

// AI activity data for all students (already exists for stu-001)
export const mockAIActivity: Record<string, any> = {
  "stu-001": {
    total_queries: 234,
    avg_response_time: 2.3,
    conversations: [
      {
        id: "conv-1",
        timestamp: "2025-10-16T10:30:00",
        topic: "Organic Chemistry - Nomenclature",
        question: "Can you explain IUPAC naming for alkanes?",
        answer: "IUPAC naming for alkanes follows a systematic approach. First, identify the longest continuous carbon chain...",
        duration: 45,
        follow_up_count: 3,
        satisfaction: 5
      },
      {
        id: "conv-2",
        timestamp: "2025-10-16T08:15:00",
        topic: "Calculus - Integration",
        question: "How do I solve integration by parts?",
        answer: "Integration by parts uses the formula: ∫u dv = uv - ∫v du. The key is choosing u and dv wisely...",
        duration: 62,
        follow_up_count: 5,
        satisfaction: 4
      },
      {
        id: "conv-3",
        timestamp: "2025-10-15T16:45:00",
        topic: "Physics - Mechanics",
        question: "What's the difference between velocity and acceleration?",
        answer: "Velocity is the rate of change of position, while acceleration is the rate of change of velocity...",
        duration: 28,
        follow_up_count: 1,
        satisfaction: 5
      }
    ],
    usage_pattern: {
      by_hour: [2, 1, 0, 0, 0, 0, 3, 8, 15, 22, 28, 25, 18, 16, 24, 29, 18, 12, 8, 5, 3, 2, 1, 1],
      by_topic: { "Chemistry": 45, "Physics": 32, "Mathematics": 23 }
    },
    engagement_score: 87
  }
};

// Followups data for all students (already exists for stu-001 and stu-003)
export const mockFollowups: Record<string, any[]> = {
  "stu-001": [
    {
      id: "followup-1",
      type: "test_reminder",
      message: "Complete pending Chemistry assignment on Organic Reactions",
      priority: "high",
      scheduled_for: "2025-10-17T09:00:00",
      status: "pending",
      created_at: "2025-10-15T14:30:00"
    },
    {
      id: "followup-2",
      type: "ai_tutorial_prompt",
      message: "Low score in Organic Chemistry - suggested AI tutorial session",
      priority: "medium",
      scheduled_for: "2025-10-18T15:00:00",
      status: "pending",
      created_at: "2025-10-15T16:20:00"
    }
  ],
  "stu-003": [
    {
      id: "followup-3",
      type: "general",
      message: "Student at risk - schedule counseling session",
      priority: "high",
      scheduled_for: "2025-10-17T10:00:00",
      status: "pending",
      created_at: "2025-10-14T09:00:00"
    },
    {
      id: "followup-4",
      type: "test_reminder",
      message: "No DPT tests taken in 5 days",
      priority: "high",
      scheduled_for: "2025-10-16T09:00:00",
      status: "pending",
      created_at: "2025-10-15T08:00:00"
    }
  ]
};

// Activity log data for all students (already exists for stu-001)
export const mockActivityLog: Record<string, any[]> = {
  "stu-001": [
    { type: "login", timestamp: "2025-10-16T14:30:00", description: "Logged in via web" },
    { type: "course_access", timestamp: "2025-10-16T14:32:00", description: "Accessed JEE Main 2025 Complete" },
    { type: "ai_query", timestamp: "2025-10-16T10:30:00", description: "Asked about Organic Chemistry" },
    { type: "test_complete", timestamp: "2025-10-16T09:15:00", description: "Completed DPT - Score: 82" },
    { type: "assignment_submit", timestamp: "2025-10-15T18:20:00", description: "Submitted Physics Assignment" },
    { type: "live_class_join", timestamp: "2025-10-15T16:00:00", description: "Joined Mathematics Live Class" }
  ]
};
