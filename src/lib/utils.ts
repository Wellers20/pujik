import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Премиальные пастельные градиенты для аватарок (в стиле iOS/Apple)
export function generateAvatarStyle(str: string = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 45) % 360;
  // Генерируем мягкий, "дорогой" градиент
  return { 
    background: `linear-gradient(135deg, hsl(${h1}, 80%, 85%), hsl(${h2}, 85%, 75%))`,
    color: `hsl(${h1}, 40%, 30%)` // Темный текст того же оттенка для контраста
  };
}

export function getAvatarText(str: string = '') {
  return str.substring(0, 1).toUpperCase();
}
