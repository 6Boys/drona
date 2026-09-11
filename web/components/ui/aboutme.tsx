"use client";

import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Badge component with smooth floating animation
const Badge = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => (
  <motion.span
    className="inline-block px-3 py-1 text-xs font-semibold bg-gray-200/30 text-gray-700 rounded-full"
    animate={{ y: [0, -4, 0] }}
    transition={{ duration: 2, repeat: Infinity, repeatType: "loop", delay }}
  >
    {children}
  </motion.span>
);

// Button component
const Button = ({ children, variant, onClick }: { children: React.ReactNode; variant?: "outline"; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "px-6 py-2 rounded font-semibold transition-all text-sm",
      variant === "outline"
        ? "border border-gray-400 text-gray-700 hover:bg-gray-100"
        : "bg-gray-700 text-white hover:bg-gray-800"
    )}
  >
    {children}
  </button>
);

// RotatingText component
const RotatingText = forwardRef(({ texts, rotationInterval = 2500, auto = true, mainClassName }: { texts: string[], rotationInterval?: number, auto?: boolean, mainClassName?: string }, ref) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const next = useCallback(() => setCurrentIndex((prev) => (prev + 1) % texts.length), [texts.length]);

  useImperativeHandle(ref, () => ({ next }));

  useEffect(() => {
    if (!auto) return;
    const interval = setInterval(next, rotationInterval);
    return () => clearInterval(interval);
  }, [next, rotationInterval, auto]);

  return (
    <span className={cn("inline-flex text-gray-700 font-bold", mainClassName)}>
      <AnimatePresence mode="wait">
        <motion.span
          key={currentIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4 }}
        >
          {Array.from(texts[currentIndex] || "").map((char, i) => (
            <span key={i} className="inline-block">
              {char}
            </span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
});

RotatingText.displayName = "RotatingText";

// Main AboutMe Component
const AboutMe = () => {
  const roles = ["Web-Developer", "aspiring_AI/ML_trainer", "Problem Solver", "Innovator"];
  const skills = ["React", "JavaScript", "Node.js", "Python", "AWS", "Docker","Vite", "TailwindCSS", "Framer Motion", "GSAP animations"];
  const projects = [
    {
      id: 1,
      title: "Anikzzzy Wallet",
      description: "A sleek, intuitive digital wallet interface that lets you manage your funds with ease—featuring balance checks, money transfers, top-ups, and secure authentication.",
      technologies: ["React", "Node.js","Tailwind CSS", "React Hooks","React Router" , "Vercel"],
      githubUrl: "https://github.com/Aniket-Rathour/Anikzzzy-wallet",
      liveUrl: "https://anikzzzy-wallet.vercel.app/"
    },
    {
      id: 2,
      title: "ANIKZZZY — E-Commerce Website",
      description: "A colorful, beginner-friendly e-commerce frontend where users can browse collections, view product details, and manage a cart—built with React, Vite, and Tailwind.",
      technologies: ["Next.js", "MongoDB","React","Tailwind CSS","react-router-dom", "Context API","Vercel"],
      githubUrl: "https://github.com/Aniket-Rathour/Anikzzzy-E_Commerce-website",
      liveUrl: "https://anikzzzy-e-commerce-website.vercel.app/"
    },
    {
      id: 3,
      title: "Todo List API",
      description: "A minimal yet powerful Todo List REST API, designed for simplicity, security, and scalability.",
      technologies: ["Next.js", "MongoDB"],
      githubUrl: "https://github.com/Aniket-Rathour/Todo-list",
      liveUrl: "https://todo-list-ecru-theta-40.vercel.app/"
    }
  ];
  const experience = [
    { id: 1, company: "Mangal Bajaar", position: "CHOR", duration: "2022 - Present", description: "Target: wallet/mobiles/choti bachchi" },
    { id: 2, company: "Near Shiv Mandir", position: "harasser", duration: "2020 - 2022", description: "Target: badi bachchi" },
  ];

  const [activeTab, setActiveTab] = useState("projects");

  return (
    <div className="min-h-screen bg-white text-gray-800 flex flex-col items-center justify-center p-8 space-y-12">

      {/* Hero Section */}
      <section className="flex flex-col items-center text-center space-y-4">
        <motion.div
          className="relative w-48 h-48 mb-4"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <motion.img
            src="/me.jpeg" // <-- put your image in public folder here
            alt="Profile"
            className="w-full h-full rounded-full border-4 border-gray-300 object-cover"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 200 }}
          />
          {/* Floating icons */}
          <motion.div
            className="absolute -top-4 -right-4 w-10 h-10 bg-gray-200/30 rounded-full flex items-center justify-center text-gray-700"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            💻
          </motion.div>
          <motion.div
            className="absolute -bottom-4 -left-4 w-8 h-8 bg-gray-300/30 rounded-full flex items-center justify-center text-gray-700"
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            ⚡
          </motion.div>
        </motion.div>

        <motion.h1
          className="text-4xl md:text-6xl font-bold"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Hi, I'm <span className="text-gray-700">Aniket Rathore</span>
        </motion.h1>

        <motion.div
          className="text-xl md:text-2xl flex items-center gap-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          I'm a <RotatingText texts={roles} rotationInterval={3000} mainClassName="text-gray-500" />
        </motion.div>

        <motion.p
          className="max-w-xl text-gray-500 mt-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          First-year student exploring the world of web development, 
          passionate about building creative and functional projects. 
          Aspiring AI/ML engineer, eager to dive into the field soon and 
          combine web and AI to solve real-world problems.
        </motion.p>

        <motion.div
          className="flex flex-wrap gap-2 justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          {skills.map((skill, i) => <Badge key={skill} delay={i * 0.2}>{skill}</Badge>)}
        </motion.div>

        <motion.div
          className="flex gap-4 mt-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <a href="https://github.com/Aniket-Rathour?tab=repositories" target="_blank" rel="noopener noreferrer">
            <Button>View Projects</Button>
          </a>
          <a href="https://github.com/Aniket-Rathour" target="_blank" rel="noopener noreferrer">
            <Button variant="outline">GitHub</Button>
          </a>
          <a href="https://www.linkedin.com/in/aniket-rathore-27a4192b5/" target="_blank" rel="noopener noreferrer">
            <Button>Linkedin</Button>
          </a>
          <a href="https://www.instagram.com/toffee_chor/" target="_blank" rel="noopener noreferrer">
            <Button variant="outline">Instagram</Button>
          </a>
          <a href="https://x.com/Aniket_rathore7" target="_blank" rel="noopener noreferrer">
            <Button>Twitter</Button>
          </a>
        </motion.div>
      </section>

      {/* Tabs Section */}
      <section className="w-full max-w-4xl">
        <div className="flex justify-center gap-4 mb-6">
          <button
            className={cn("px-4 py-2 rounded font-semibold text-sm", activeTab === "projects" ? "bg-gray-200 text-gray-800" : "bg-gray-100 text-gray-600")}
            onClick={() => setActiveTab("projects")}
          >
            Projects
          </button>
          <button
            className={cn("px-4 py-2 rounded font-semibold text-sm", activeTab === "experience" ? "bg-gray-200 text-gray-800" : "bg-gray-100 text-gray-600")}
            onClick={() => setActiveTab("experience")}
          >
            Experience
          </button>
        </div>

        {activeTab === "projects" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((proj, index) => (
              <motion.div
                key={proj.id}
                className="border border-gray-300 rounded p-4 hover:shadow-md transition-shadow"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <h3 className="font-bold text-gray-800 mb-1">{proj.title}</h3>
                <p className="text-gray-500 mb-2">{proj.description}</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {proj.technologies.map((tech) => <Badge key={tech}>{tech}</Badge>)}
                </div>
                <div className="flex gap-2">
                  <a href={proj.githubUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline">Code</Button>
                  </a>
                  <a href={proj.liveUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline">Live</Button>
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === "experience" && (
          <div className="space-y-4">
            {experience.map((exp, index) => (
              <motion.div
                key={exp.id}
                className="border border-gray-300 rounded p-4 hover:shadow-md transition-shadow"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <h3 className="font-bold text-gray-800">{exp.position}</h3>
                <p className="text-gray-600">{exp.company}</p>
                <p className="text-gray-500 text-sm">{exp.duration}</p>
                <p className="text-gray-500 mt-2">{exp.description}</p>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Contribution Section */}
      <section className="text-center mt-12 space-y-4">
        <motion.h2
          className="text-3xl font-bold text-gray-800"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Like this project?
        </motion.h2>
        <motion.p
          className="text-gray-500 max-w-xl mx-auto"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          If you enjoy this project and want to contribute, feel free to jump in! Your contributions are always welcome.
        </motion.p>
        <motion.div
          className="flex justify-center gap-4"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <a href="https://github.com/Aniket-Rathour/Drona-Sphere" target="_blank" rel="noopener noreferrer">
            <Button>Contribute on GitHub</Button>
          </a>
          <a href="https://github.com/Aniket-Rathour" target="_blank" rel="noopener noreferrer">
            <Button variant="outline">Star the Project</Button>
          </a>
        </motion.div>
      </section>
    </div>
  );
};

export default AboutMe;
