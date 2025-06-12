import confetti from "canvas-confetti";

// Standard confetti celebration for successful actions
export const triggerSuccessConfetti = () => {
  // Main confetti burst
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 }
  });
  
  // Additional smaller bursts for more celebration
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 }
    });
  }, 150);
  
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 }
    });
  }, 300);
};

// Celebration for payment/earnings related actions
export const triggerEarningsConfetti = () => {
  confetti({
    particleCount: 150,
    spread: 60,
    origin: { y: 0.7 },
    colors: ['#FFD700', '#32CD32', '#00FF00', '#ADFF2F']
  });

  setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 90,
      spread: 45,
      origin: { y: 0.8 },
      colors: ['#FFD700', '#32CD32']
    });
  }, 200);
};

// Celebration for student-related achievements
export const triggerStudentConfetti = () => {
  confetti({
    particleCount: 120,
    spread: 65,
    origin: { y: 0.6 },
    colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57']
  });
  
  setTimeout(() => {
    confetti({
      particleCount: 60,
      angle: 75,
      spread: 50,
      origin: { x: 0.3 },
      colors: ['#FF6B6B', '#4ECDC4']
    });
  }, 100);
  
  setTimeout(() => {
    confetti({
      particleCount: 60,
      angle: 105,
      spread: 50,
      origin: { x: 0.7 },
      colors: ['#45B7D1', '#96CEB4']
    });
  }, 200);
};