"use client";

import React from 'react';

export default function Example() {
  const images = [
    '/offer1.png',
    '/IMG_7565.JPG',
    '/IMG_7566.JPG',
    '/IMG_7567.JPG',
    '/IMG_7568.JPG',
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900&display=swap');
    
        * {
          font-family: 'Poppins', sans-serif;
        }
      `}</style>
      <section className="w-full flex flex-col items-center justify-start py-12">
      
        <div className="max-w-3xl text-center px-4">
          <h1 className="text-3xl font-semibold ">What We Offer?</h1>
          <p className="text-sm text-slate-500 mt-2 ">
            A visual representation of everything we offer, showcasing our vision, values, and the unique experiences we aim to create for our users.
          </p>
        </div>

        {/* Галерея снизу */}
        <div className="flex items-center gap-1 h-[400px] w-full max-w-5xl mt-10 px-2">
          {images.map((src, idx) => (
            <div
              key={idx}
              className="relative group flex-grow transition-all w-56 rounded-lg overflow-hidden h-[400px] duration-500 hover:w-full">
              <img
                className="h-full w-full object-cover object-center"
                src={src}
                alt={`image-${idx}`} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
