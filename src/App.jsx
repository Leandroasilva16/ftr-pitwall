import React, { useState, useEffect, useMemo, useRef } from 'react';
import LZString from 'lz-string';
import {
  Flag,
  Clock,
  Fuel,
  Zap,
  Gauge,
  Calendar,
  RotateCcw,
  Copy,
  Check,
  Users,
  Wrench,
  Disc,
  Timer,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  MapPin,
  Share2,
  Radio,
  X,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';

const STORAGE_KEY = 'ftr_pitwall_strategy_v1';
const ROOM_PIN_STORAGE_KEY = 'ftr_pitwall_room_pin_v1';
const CLIENT_INSTANCE_ID =
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `ftr-${Math.random().toString(36).slice(2, 10)}`;

const DRIVERS = [
  'Bruno Aguiar',
  'Erich Terezzino',
  'Iuri Soares',
  'Leandro Agiani',
  'Mauricio Chara',
  'Paulo Afonso',
  'Rafael Barison',
  'Vitor Justen',
  'Convidado 01',
  'Convidado 02',
  'ND',
];

const TIRE_CORNERS = [
  { key: 'FL', label: 'Dianteiro Esquerdo' },
  { key: 'FR', label: 'Dianteiro Direito' },
  { key: 'RL', label: 'Traseiro Esquerdo' },
  { key: 'RR', label: 'Traseiro Direito' },
];

const PIT_SCENARIOS = [
  { id: '4_tires_fuel', label: '4 pneus + combustível' },
  { id: '2_tires_fuel', label: '2 pneus + combustível' },
  { id: 'fuel_only', label: 'Apenas combustível' },
  { id: 'driver_swap_only', label: 'Somente troca de piloto' },
];

const PT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const LMU_OFFICIAL_WC_EVENTS_2026 = [
  { id: 'imola', wcDate: '2026-07-07', track: '4 Hours of Imola', classes: 'ELMS LMP2, LMP3, LMGT3' },
  { id: 'interlagos', wcDate: '2026-07-14', track: '6 Hours of Interlagos', classes: 'Hypercar, LMGT3' },
  { id: 'cota', wcDate: '2026-09-08', track: '6 Hours of COTA', classes: 'Hypercar, LMGT3' },
  { id: 'silverstone-4h', wcDate: '2026-09-15', track: '4 Hours of Silverstone', classes: 'ELMS LMP2, LMP3, LMGT3' },
  { id: 'fuji', wcDate: '2026-09-29', track: '6 Hours of Fuji', classes: 'Hypercar, LMGT3' },
  { id: 'portimao', wcDate: '2026-10-13', track: '4 Hours of Portimão', classes: 'ELMS LMP2, LMP3, LMGT3' },
  { id: 'lemans', wcDate: '2026-10-20', track: '24 Hours of Le Mans', classes: 'Hypercar, WEC LMP2, LMGT3' },
  { id: 'bahrain', wcDate: '2026-11-10', track: '8 Hours of Bahrain', classes: 'Hypercar, LMGT3' },
  { id: 'monza', wcDate: '2026-11-17', track: '6 Hours of Monza', classes: 'Hypercar, LMGT3' },
  { id: 'silverstone-6h', wcDate: '2026-12-01', track: '6 Hours of Silverstone', classes: 'Hypercar, LMGT3' },
  { id: 'tba-dec', wcDate: '2026-12-15', track: '6 Hours TBA', classes: 'Hypercar, WEC LMP2, LMGT3' },
];

/**
 * Maps each official w/c date to the Saturday & Sunday of that same week
 * and marks past / next / upcoming relative to today.
 */
function buildLmuWeekendCalendar(referenceDate = new Date()) {
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );

  let foundNext = false;

  return LMU_OFFICIAL_WC_EVENTS_2026.map((ev) => {
    const [y, m, d] = ev.wcDate.split('-').map(Number);
    const wc = new Date(y, m - 1, d);
    const daysUntilSat = (6 - wc.getDay() + 7) % 7;
    const sat = new Date(wc);
    sat.setDate(wc.getDate() + daysUntilSat);
    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);

    const satDay = String(sat.getDate()).padStart(2, '0');
    const sunDay = String(sun.getDate()).padStart(2, '0');
    const satMonth = PT_MONTHS[sat.getMonth()];
    const sunMonth = PT_MONTHS[sun.getMonth()];

    const dates =
      sat.getMonth() === sun.getMonth()
        ? `${satDay} & ${sunDay} ${sunMonth}`
        : `${satDay} ${satMonth} & ${sunDay} ${sunMonth}`;

    // Only switch away from the current event on the Monday after Sunday's race
    const mondayAfter = new Date(sun);
    mondayAfter.setDate(sun.getDate() + 1);

    let status = 'upcoming';
    if (today >= mondayAfter) {
      status = 'past';
    } else if (!foundNext) {
      status = 'next';
      foundNext = true;
    }

    return {
      ...ev,
      dates,
      status,
    };
  });
}

const LMU_CAR_CLASSES = [
  { id: 'Hypercar', label: 'Hypercar', badgeClass: 'bg-red-500/20 text-red-400 border-red-500/40' },
  { id: 'LMP2', label: 'LMP2', badgeClass: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
  { id: 'LMP3', label: 'LMP3', badgeClass: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
  { id: 'LMGT3', label: 'LMGT3', badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/40' },
  { id: 'GTE', label: 'GTE', badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
];

const LMU_CARS = [
  // Hypercar
  { id: 'alpine-a424', name: 'Alpine A424', brand: 'alpine', classId: 'Hypercar' },
  { id: 'aston-valkyrie', name: 'Aston Martin Valkyrie AMR-LMH', brand: 'aston', classId: 'Hypercar' },
  { id: 'bmw-m-hybrid-v8', name: 'BMW M Hybrid V8', brand: 'bmw', classId: 'Hypercar' },
  { id: 'cadillac-v-series-r', name: 'Cadillac V-Series.R', brand: 'cadillac', classId: 'Hypercar' },
  { id: 'ferrari-499p', name: 'Ferrari 499P', brand: 'ferrari', classId: 'Hypercar' },
  { id: 'genesis-gmr-001', name: 'Genesis GMR-001', brand: 'genesis', classId: 'Hypercar' },
  { id: 'glickenhaus-007', name: 'Glickenhaus SCG 007', brand: 'glickenhaus', classId: 'Hypercar' },
  { id: 'isotta-tipo6', name: 'Isotta Fraschini Tipo 6 LMH-C', brand: 'isotta', classId: 'Hypercar' },
  { id: 'lamborghini-sc63', name: 'Lamborghini SC63', brand: 'lamborghini', classId: 'Hypercar' },
  { id: 'peugeot-9x8', name: 'Peugeot 9X8', brand: 'peugeot', classId: 'Hypercar' },
  { id: 'porsche-963', name: 'Porsche 963', brand: 'porsche', classId: 'Hypercar' },
  { id: 'toyota-gr010', name: 'Toyota GR010 Hybrid', brand: 'toyota', classId: 'Hypercar' },
  { id: 'vanwall-680', name: 'Vanwall Vandervell 680', brand: 'vanwall', classId: 'Hypercar' },
  // LMP2
  { id: 'oreca-07', name: 'Oreca 07 - Gibson', brand: 'oreca', classId: 'LMP2' },
  // LMP3
  { id: 'adess-ad25', name: 'ADESS AD25 / ADESS-03 Evo', brand: 'adess', classId: 'LMP3' },
  { id: 'duqueine-d09', name: 'Duqueine D09', brand: 'duqueine', classId: 'LMP3' },
  { id: 'ginetta-g61', name: 'Ginetta G61-LT-P3 Evo', brand: 'ginetta', classId: 'LMP3' },
  { id: 'ligier-jsp325', name: 'Ligier JS P325', brand: 'ligier', classId: 'LMP3' },
  // LMGT3
  { id: 'aston-vantage-lmgt3', name: 'Aston Martin Vantage AMR LMGT3', brand: 'aston', classId: 'LMGT3' },
  { id: 'bmw-m4-lmgt3', name: 'BMW M4 LMGT3', brand: 'bmw', classId: 'LMGT3' },
  { id: 'corvette-z06-lmgt3', name: 'Chevrolet Corvette Z06 LMGT3.R', brand: 'corvette', classId: 'LMGT3' },
  { id: 'ferrari-296-lmgt3', name: 'Ferrari 296 LMGT3', brand: 'ferrari', classId: 'LMGT3' },
  { id: 'ford-mustang-lmgt3', name: 'Ford Mustang LMGT3', brand: 'ford', classId: 'LMGT3' },
  { id: 'lamborghini-huracan-lmgt3', name: 'Lamborghini Huracán LMGT3 Evo2', brand: 'lamborghini', classId: 'LMGT3' },
  { id: 'lexus-rcf-lmgt3', name: 'Lexus RC F LMGT3', brand: 'lexus', classId: 'LMGT3' },
  { id: 'mclaren-720s-lmgt3', name: 'McLaren 720S LMGT3 Evo', brand: 'mclaren', classId: 'LMGT3' },
  { id: 'mercedes-amg-lmgt3', name: 'Mercedes-AMG LMGT3', brand: 'mercedes', classId: 'LMGT3' },
  { id: 'porsche-911-lmgt3', name: 'Porsche 911 GT3 R (992) LMGT3', brand: 'porsche', classId: 'LMGT3' },
  // GTE
  { id: 'aston-vantage-gte', name: 'Aston Martin Vantage AMR GTE', brand: 'aston', classId: 'GTE' },
  { id: 'corvette-c8r-gte', name: 'Chevrolet Corvette C8.R', brand: 'corvette', classId: 'GTE' },
  { id: 'ferrari-488-gte', name: 'Ferrari 488 GTE Evo', brand: 'ferrari', classId: 'GTE' },
  { id: 'porsche-911-rsr-gte', name: 'Porsche 911 RSR-19', brand: 'porsche', classId: 'GTE' },
];

function ManufacturerLogo({ brand, size = 28 }) {
  const s = size;
  switch (brand) {
    case 'ferrari':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <path d="M7 4h18v12c0 7-9 12-9 12s-9-5-9-12V4z" fill="#facc15" stroke="#dc2626" strokeWidth="1.5" />
          <path d="M7 4h18v3H7z" fill="#16a34a" />
          <text x="16" y="21" textAnchor="middle" fontSize="10" fontWeight="900" fill="#0f172a" fontFamily="sans-serif">SF</text>
        </svg>
      );
    case 'porsche':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <path d="M7 4h18v12c0 7-9 12-9 12s-9-5-9-12V4z" fill="#eab308" stroke="#fef08a" strokeWidth="1" />
          <path d="M8 5h8v8H8zM16 13h8v8h-8z" fill="#dc2626" />
          <path d="M16 5h8v8h-8zM8 13h8v8H8z" fill="#111827" />
          <text x="16" y="19" textAnchor="middle" fontSize="8" fontWeight="900" fill="#facc15" fontFamily="sans-serif">P</text>
        </svg>
      );
    case 'bmw':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <circle cx="16" cy="16" r="12" fill="#0f172a" stroke="#e2e8f0" strokeWidth="1.5" />
          <path d="M16 6a10 10 0 0 1 10 10H16V6z" fill="#38bdf8" />
          <path d="M6 16a10 10 0 0 1 10-10v10H6z" fill="#f8fafc" />
          <path d="M16 16h10a10 10 0 0 1-10 10V16z" fill="#f8fafc" />
          <path d="M6 16h10v10A10 10 0 0 1 6 16z" fill="#38bdf8" />
        </svg>
      );
    case 'toyota':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <rect x="3" y="6" width="26" height="20" rx="4" fill="#dc2626" />
          <text x="16" y="20" textAnchor="middle" fontSize="11" fontWeight="900" fill="#ffffff" fontFamily="sans-serif">GR</text>
        </svg>
      );
    case 'aston':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <path d="M3 13l13-4 13 4-4 6H7l-4-6z" fill="#10b981" stroke="#a7f3d0" strokeWidth="1.2" />
          <text x="16" y="18" textAnchor="middle" fontSize="8" fontWeight="800" fill="#0f172a" fontFamily="sans-serif">AM</text>
        </svg>
      );
    case 'cadillac':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <path d="M6 5h20l-2 15-8 7-8-7L6 5z" fill="#eab308" stroke="#fef08a" strokeWidth="1" />
          <rect x="9" y="8" width="7" height="6" fill="#dc2626" />
          <rect x="16" y="8" width="7" height="6" fill="#2563eb" />
          <rect x="9" y="14" width="7" height="5" fill="#111827" />
          <rect x="16" y="14" width="7" height="5" fill="#f8fafc" />
        </svg>
      );
    case 'alpine':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <circle cx="16" cy="16" r="12" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
          <path d="M16 7l8 16h-4l-4-8-4 8H8l8-16z" fill="#ffffff" />
        </svg>
      );
    case 'peugeot':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <path d="M7 5h18v11c0 7-9 11-9 11s-9-4-9-11V5z" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="1.4" />
          <text x="16" y="20" textAnchor="middle" fontSize="10" fontWeight="900" fill="#93c5fd" fontFamily="sans-serif">9X8</text>
        </svg>
      );
    case 'lamborghini':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <path d="M7 5h18v12c0 6-9 10-9 10s-9-4-9-10V5z" fill="#111827" stroke="#eab308" strokeWidth="1.6" />
          <text x="16" y="20" textAnchor="middle" fontSize="10" fontWeight="900" fill="#eab308" fontFamily="sans-serif">LB</text>
        </svg>
      );
    case 'mclaren':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <rect x="3" y="6" width="26" height="20" rx="4" fill="#0f172a" stroke="#f97316" strokeWidth="1.5" />
          <path d="M7 20c5-7 13-9 18-6-5 2-9 4-11 8-2-1-4-2-7-2z" fill="#f97316" />
        </svg>
      );
    case 'mercedes':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <circle cx="16" cy="16" r="12" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.5" />
          <path d="M16 5v11m0 0l-9 6m9-6l9 6" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'ford':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <ellipse cx="16" cy="16" rx="13" ry="8" fill="#1d4ed8" stroke="#93c5fd" strokeWidth="1.4" />
          <text x="16" y="19" textAnchor="middle" fontSize="8" fontWeight="800" fill="#ffffff" fontFamily="serif" fontStyle="italic">Ford</text>
        </svg>
      );
    case 'corvette':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <path d="M5 10l11 6 11-6-3 12-8-4-8 4-3-12z" fill="#eab308" stroke="#dc2626" strokeWidth="1.4" />
        </svg>
      );
    case 'lexus':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <ellipse cx="16" cy="16" rx="12" ry="9" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.5" />
          <path d="M14 9l-3 10h9" stroke="#f8fafc" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </svg>
      );
    default: {
      const tagMap = {
        oreca: { txt: 'OR', bg: '#0284c7', fg: '#ffffff' },
        ligier: { txt: 'LG', bg: '#2563eb', fg: '#ffffff' },
        duqueine: { txt: 'DQ', bg: '#7c3aed', fg: '#ffffff' },
        ginetta: { txt: 'GN', bg: '#ea580c', fg: '#ffffff' },
        adess: { txt: 'AD', bg: '#4f46e5', fg: '#ffffff' },
        genesis: { txt: 'GN', bg: '#b45309', fg: '#fef3c7' },
        glickenhaus: { txt: 'SCG', bg: '#dc2626', fg: '#ffffff' },
        isotta: { txt: 'IF', bg: '#0f766e', fg: '#ffffff' },
        vanwall: { txt: 'VW', bg: '#15803d', fg: '#ffffff' },
      };
      const cfg = tagMap[brand] || { txt: 'LMU', bg: '#334155', fg: '#f8fafc' };
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <rect x="3" y="5" width="26" height="22" rx="5" fill={cfg.bg} />
          <text x="16" y="20" textAnchor="middle" fontSize="9.5" fontWeight="900" fill={cfg.fg} fontFamily="sans-serif">
            {cfg.txt}
          </text>
        </svg>
      );
    }
  }
}

const LMU_CIRCUITS = [
  {
    id: 'imola',
    name: 'Autodromo Internazionale Enzo e Dino Ferrari (Imola)',
    shortName: 'Imola',
    country: 'Itália',
    flag: '🇮🇹',
    svgPath: 'M14 48 C22 48, 34 45, 42 38 L50 28 C54 22, 62 24, 68 20 C76 15, 92 14, 102 22 C110 29, 106 42, 94 45 C86 47, 82 40, 76 42 C68 45, 64 55, 52 55 C38 55, 24 54, 14 48 Z',
  },
  {
    id: 'portimao',
    name: 'Autódromo Internacional do Algarve (Portimão)',
    shortName: 'Portimão',
    country: 'Portugal',
    flag: '🇵🇹',
    svgPath: 'M16 46 L54 46 C64 46, 72 39, 68 31 C64 23, 74 14, 88 16 C100 18, 108 27, 102 36 C96 44, 86 43, 82 50 C78 56, 62 56, 46 53 C32 51, 20 55, 16 46 Z',
  },
  {
    id: 'interlagos',
    name: 'Autódromo José Carlos Pace (Interlagos)',
    shortName: 'Interlagos',
    country: 'Brasil',
    flag: '🇧🇷',
    svgPath: 'M24 52 C14 46, 13 31, 24 22 C35 13, 62 14, 84 19 C100 23, 107 34, 98 42 C90 48, 78 44, 72 37 C66 30, 56 36, 54 44 C52 52, 34 58, 24 52 Z',
  },
  {
    id: 'monza',
    name: 'Autodromo Nazionale Monza',
    shortName: 'Monza',
    country: 'Itália',
    flag: '🇮🇹',
    svgPath: 'M18 46 L18 24 C18 16, 26 15, 36 16 L82 16 C96 16, 106 20, 104 30 C102 38, 92 40, 84 44 C76 48, 66 50, 50 50 L26 50 C20 50, 18 48, 18 46 Z',
  },
  {
    id: 'bahrain',
    name: 'Bahrain International Circuit',
    shortName: 'Bahrain',
    country: 'Bahrein',
    flag: '🇧🇭',
    svgPath: 'M18 50 L18 22 C18 16, 26 16, 36 16 L76 16 C88 16, 94 22, 86 28 C78 34, 78 39, 90 42 C102 45, 100 55, 86 55 C72 55, 64 46, 52 46 C40 46, 34 55, 24 55 C19 55, 18 53, 18 50 Z',
  },
  {
    id: 'barcelona',
    name: 'Circuit de Barcelona-Catalunya',
    shortName: 'Barcelona',
    country: 'Espanha',
    flag: '🇪🇸',
    svgPath: 'M16 44 L54 44 C64 44, 74 36, 82 26 C88 18, 102 18, 104 28 C106 38, 94 47, 84 51 C72 56, 62 50, 52 53 C40 57, 20 56, 16 44 Z',
  },
  {
    id: 'lemans',
    name: 'Circuit de la Sarthe (Le Mans)',
    shortName: 'Le Mans',
    country: 'França',
    flag: '🇫🇷',
    svgPath: 'M16 30 C16 20, 28 16, 42 18 L86 22 C100 23, 106 30, 102 40 C98 50, 84 54, 68 52 C56 50, 44 46, 34 48 C22 50, 16 42, 16 30 Z',
  },
  {
    id: 'spa',
    name: 'Circuit de Spa-Francorchamps',
    shortName: 'Spa',
    country: 'Bélgica',
    flag: '🇧🇪',
    svgPath: 'M24 53 C17 48, 16 36, 24 27 C32 18, 48 14, 64 16 C82 18, 100 24, 104 34 C107 42, 96 48, 84 46 C74 44, 68 38, 60 42 C52 46, 44 55, 32 55 C28 55, 26 54, 24 53 Z',
  },
  {
    id: 'cota',
    name: 'Circuit of the Americas (COTA)',
    shortName: 'COTA',
    country: 'EUA',
    flag: '🇺🇸',
    svgPath: 'M14 48 L34 18 C37 14, 42 18, 45 25 C49 34, 57 32, 62 24 C68 15, 86 16, 98 24 C108 31, 106 44, 94 50 C80 56, 60 50, 44 52 C30 54, 18 54, 14 48 Z',
  },
  {
    id: 'paul-ricard',
    name: 'Circuit Paul Ricard',
    shortName: 'Paul Ricard',
    country: 'França',
    flag: '🇫🇷',
    svgPath: 'M16 42 C16 30, 28 22, 44 20 L88 18 C100 18, 106 26, 100 35 C94 44, 80 46, 68 43 C58 40, 50 48, 38 52 C26 55, 16 50, 16 42 Z',
  },
  {
    id: 'daytona',
    name: 'Daytona International Speedway',
    shortName: 'Daytona',
    country: 'EUA',
    flag: '🇺🇸',
    svgPath: 'M18 35 C18 15, 102 15, 102 35 C102 55, 18 55, 18 35 Z M40 35 C46 43, 74 43, 80 35',
  },
  {
    id: 'fuji',
    name: 'Fuji Speedway',
    shortName: 'Fuji',
    country: 'Japão',
    flag: '🇯🇵',
    svgPath: 'M16 42 L76 42 C90 42, 102 34, 98 24 C94 16, 76 16, 62 22 C50 27, 42 31, 34 26 C26 21, 16 28, 16 42 Z',
  },
  {
    id: 'lusail',
    name: 'Lusail International Circuit (Qatar)',
    shortName: 'Qatar',
    country: 'Catar',
    flag: '🇶🇦',
    svgPath: 'M18 46 L18 24 C18 16, 28 16, 40 16 L76 18 C92 19, 104 28, 102 40 C100 50, 86 55, 72 51 C60 47, 52 44, 42 50 C32 56, 18 54, 18 46 Z',
  },
  {
    id: 'road-atlanta',
    name: 'Michelin Raceway Road Atlanta',
    shortName: 'Road Atlanta',
    country: 'EUA',
    flag: '🇺🇸',
    svgPath: 'M14 42 C20 26, 36 18, 56 18 C74 18, 92 24, 102 34 C108 40, 102 50, 88 51 C72 52, 58 46, 44 48 C30 50, 18 52, 14 42 Z',
  },
  {
    id: 'sebring',
    name: 'Sebring International Raceway',
    shortName: 'Sebring',
    country: 'EUA',
    flag: '🇺🇸',
    svgPath: 'M16 44 L24 24 C27 18, 36 16, 48 18 L82 22 C94 24, 104 32, 100 42 C96 50, 80 52, 64 49 L34 52 C22 53, 14 50, 16 44 Z',
  },
  {
    id: 'silverstone',
    name: 'Silverstone Circuit',
    shortName: 'Silverstone',
    country: 'Reino Unido',
    flag: '🇬🇧',
    svgPath: 'M22 48 C16 38, 18 24, 30 18 C44 12, 68 14, 86 20 C102 25, 106 38, 96 47 C86 55, 72 48, 62 46 C52 44, 44 55, 32 54 C26 53, 24 51, 22 48 Z',
  },
  {
    id: 'long-beach',
    name: 'Streets of Long Beach',
    shortName: 'Long Beach',
    country: 'EUA',
    flag: '🇺🇸',
    svgPath: 'M16 42 L56 42 C64 42, 68 31, 76 29 L98 29 C104 29, 105 38, 102 44 C98 50, 82 52, 64 52 L24 52 C17 52, 16 47, 16 42 Z',
  },
  {
    id: 'laguna-seca',
    name: 'WeatherTech Raceway Laguna Seca',
    shortName: 'Laguna Seca',
    country: 'EUA',
    flag: '🇺🇸',
    svgPath: 'M18 44 C20 30, 32 18, 48 17 C60 16, 66 26, 74 30 C82 34, 96 26, 102 34 C108 42, 96 53, 80 53 C60 53, 36 53, 22 50 C19 49, 18 47, 18 44 Z',
  },
];

function CircuitTrackSvg({ svgPath, className = 'h-12 w-24' }) {
  return (
    <svg
      viewBox="0 0 120 70"
      className={`${className} drop-shadow-[0_0_5px_rgba(234,179,8,0.35)]`}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={svgPath} stroke="#0f172a" strokeWidth="7" opacity="0.9" />
      <path d={svgPath} stroke="#334155" strokeWidth="5" opacity="0.85" />
      <path d={svgPath} stroke="currentColor" strokeWidth="2.6" />
    </svg>
  );
}

const DRIVER_PORTRAIT_PRESETS = {
  'Bruno Aguiar': {
    suit: '#1e3a8a',
    suitDark: '#172554',
    stripe: '#f97316',
    hair: '#1c1917',
    hairHi: '#44403c',
    skin: '#f1c27d',
    skinDark: '#c68642',
    shades: true,
    helmet: false,
    bgTop: '#1e293b',
    bgBot: '#0f172a',
  },
  'Erich Terezzino': {
    suit: '#18181b',
    suitDark: '#09090b',
    stripe: '#f97316',
    hair: '#3b2f2f',
    hairHi: '#78716c',
    skin: '#ffdbac',
    skinDark: '#d9a066',
    shades: false,
    bald: true,
    helmet: false,
    bgTop: '#172554',
    bgBot: '#0f172a',
  },
  'Iuri Soares': {
    suit: '#f1f5f9',
    suitDark: '#cbd5e1',
    stripe: '#334155',
    hair: '#0f172a',
    hairHi: '#334155',
    skin: '#e0ac69',
    skinDark: '#b37b3b',
    shades: true,
    helmet: false,
    bgTop: '#14532d',
    bgBot: '#052e16',
  },
  'Leandro Agiani': {
    suit: '#18181b',
    suitDark: '#09090b',
    stripe: '#f97316',
    hair: '#292524',
    hairHi: '#57534e',
    skin: '#f1c27d',
    skinDark: '#c68642',
    shades: false,
    prescription: true,
    helmet: false,
    bgTop: '#1e3a8a',
    bgBot: '#0f172a',
  },
  'Mauricio Chara': {
    suit: '#1e3a8a',
    suitDark: '#172554',
    stripe: '#f97316',
    hair: '#0f172a',
    hairHi: '#334155',
    skin: '#ffdbac',
    skinDark: '#e2b482',
    shades: false,
    eastAsianEyes: true,
    helmet: false,
    bgTop: '#172554',
    bgBot: '#0f172a',
  },
  'Paulo Afonso': {
    suit: '#18181b',
    suitDark: '#09090b',
    stripe: '#84cc16',
    hair: '#94a3b8',
    hairHi: '#e2e8f0',
    skin: '#f1c27d',
    skinDark: '#c68642',
    shades: true,
    helmet: false,
    bgTop: '#14532d',
    bgBot: '#0f172a',
  },
  'Rafael Barison': {
    suit: '#18181b',
    suitDark: '#09090b',
    stripe: '#f97316',
    hair: '#1c1917',
    hairHi: '#57534e',
    skin: '#ffdbac',
    skinDark: '#d9a066',
    shades: false,
    helmet: false,
    bgTop: '#0c4a6e',
    bgBot: '#0f172a',
  },
  'Vitor Justen': {
    suit: '#0f766e',
    suitDark: '#115e59',
    stripe: '#facc15',
    hair: '#78350f',
    hairHi: '#b45309',
    skin: '#f1c27d',
    skinDark: '#c68642',
    shades: false,
    helmet: false,
    bgTop: '#134e4a',
    bgBot: '#0f172a',
  },
  'Convidado 01': {
    suit: '#475569',
    suitDark: '#334155',
    stripe: '#eab308',
    hair: '#0f172a',
    hairHi: '#475569',
    skin: '#e0ac69',
    skinDark: '#b37b3b',
    shades: true,
    helmet: false,
    bgTop: '#1e293b',
    bgBot: '#0f172a',
  },
  'Convidado 02': {
    suit: '#334155',
    suitDark: '#1e293b',
    stripe: '#22c55e',
    hair: '#3f3f46',
    hairHi: '#71717a',
    skin: '#ffdbac',
    skinDark: '#d9a066',
    shades: true,
    helmet: false,
    bgTop: '#1e293b',
    bgBot: '#0f172a',
  },
};

function DriverAvatar90s({ driver, size = 48 }) {
  if (driver === 'ND') {
    return (
      <div
        className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border-2 border-[#475569] bg-[#0f172a] shadow-md"
        style={{ width: size, height: size }}
        title="Piloto: ND (Não Definido)"
      >
        <svg width={size} height={size} viewBox="0 0 64 64" className="block">
          <rect width="64" height="64" fill="#0f172a" />
          <path
            d="M10 64 C11 50, 19 43, 32 43 C45 43, 53 50, 54 64 Z"
            fill="#334155"
          />
          <circle cx="32" cy="24" r="12" fill="#334155" />
          <path
            d="M21 22 C21 15, 26 11, 32 11 C38 11, 43 15, 43 22 L41 26 L23 26 Z"
            fill="#1e293b"
          />
        </svg>
      </div>
    );
  }

  const p = DRIVER_PORTRAIT_PRESETS[driver] || DRIVER_PORTRAIT_PRESETS['Convidado 01'];

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border-2 border-[#64748b] bg-[#0f172a] shadow-md"
      style={{ width: size, height: size }}
      title={`Piloto: ${driver}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        shapeRendering="crispEdges"
        className="block"
      >
        {/* Mega Drive 16-bit Dithered Backdrop */}
        <rect width="64" height="36" fill={p.bgTop} />
        <rect y="36" width="64" height="28" fill={p.bgBot} />
        <rect y="2" width="64" height="1" fill="#ffffff" fillOpacity="0.06" />
        <rect y="10" width="64" height="1" fill="#ffffff" fillOpacity="0.05" />
        <rect y="18" width="64" height="1" fill="#ffffff" fillOpacity="0.04" />
        <rect y="26" width="64" height="1" fill="#ffffff" fillOpacity="0.04" />
        {/* Checkered Pitwall Banner Strip */}
        <rect x="0" y="34" width="8" height="2" fill="#eab308" fillOpacity="0.35" />
        <rect x="16" y="34" width="8" height="2" fill="#eab308" fillOpacity="0.35" />
        <rect x="32" y="34" width="8" height="2" fill="#eab308" fillOpacity="0.35" />
        <rect x="48" y="34" width="8" height="2" fill="#eab308" fillOpacity="0.35" />

        {/* Racing Suit Shoulders & Torso */}
        <path d="M6 64 L8 48 L18 42 L46 42 L56 48 L58 64 Z" fill={p.suit} />
        {/* Shoulder Shading */}
        <path d="M6 64 L8 48 L15 44 L15 64 Z" fill={p.suitDark} />
        <path d="M58 64 L56 48 L49 44 L49 64 Z" fill={p.suitDark} />
        {/* Suit Vertical Stripes */}
        <rect x="17" y="43" width="3" height="21" fill={p.stripe} />
        <rect x="44" y="43" width="3" height="21" fill={p.stripe} />
        {/* Center Zipper Placket */}
        <rect x="30" y="44" width="4" height="20" fill="#0f172a" />
        <rect x="31" y="45" width="2" height="18" fill="#cbd5e1" />
        {/* Velcro Racing Collar */}
        <rect x="22" y="40" width="20" height="6" fill="#f8fafc" />
        <rect x="24" y="41" width="16" height="4" fill={p.suitDark} />
        <rect x="29" y="41" width="6" height="4" fill="#eab308" />
        {/* Chest Sponsor Patches */}
        <rect x="21" y="50" width="7" height="4" fill="#f8fafc" />
        <rect x="22" y="51" width="5" height="2" fill="#dc2626" />
        <rect x="36" y="50" width="7" height="4" fill="#f8fafc" />
        <rect x="37" y="51" width="5" height="2" fill="#0f172a" />

        {/* Neck & Chin Shadow */}
        <rect x="26" y="34" width="12" height="8" fill={p.skinDark} />
        <rect x="28" y="34" width="8" height="7" fill={p.skin} />

        {p.helmet ? (
          <>
            {/* Iconic Senna-inspired Yellow/Green/Blue 16-bit Helmet */}
            <path d="M16 26 C16 12, 22 6, 32 6 C42 6, 48 12, 48 26 L46 37 L18 37 Z" fill="#facc15" />
            {/* Helmet Top Highlight */}
            <path d="M22 10 C27 7, 37 7, 42 10 L40 13 C35 11, 29 11, 24 13 Z" fill="#fef08a" />
            {/* Classic Green & Blue Racing Stripes */}
            <rect x="16" y="21" width="32" height="3" fill="#16a34a" />
            <rect x="16" y="24" width="32" height="2" fill="#1d4ed8" />
            {/* Visor Opening */}
            <rect x="20" y="17" width="24" height="10" rx="2" fill="#0f172a" />
            {/* Visor Glare */}
            <rect x="22" y="19" width="7" height="2" fill="#38bdf8" />
            <rect x="35" y="19" width="5" height="2" fill="#38bdf8" />
            {/* Chin Guard */}
            <rect x="21" y="29" width="22" height="7" fill="#eab308" />
            <rect x="27" y="31" width="10" height="3" fill="#0f172a" />
          </>
        ) : (
          <>
            {/* Ears */}
            <rect x="18" y="22" width="3" height="7" fill={p.skinDark} />
            <rect x="43" y="22" width="3" height="7" fill={p.skinDark} />

            {/* Sculpted Face */}
            <path d="M20 14 L44 14 L44 30 L38 37 L26 37 L20 30 Z" fill={p.skin} />
            {/* Jawline & Cheek Shading */}
            <path d="M20 26 L23 30 L27 35 L37 35 L41 30 L44 26 L44 30 L38 37 L26 37 L20 30 Z" fill={p.skinDark} />

            {p.bald ? (
              <>
                {/* Bald Head Top Dome + Scalp Highlight + Side Hair */}
                <path d="M20 15 C20 8, 25 6, 32 6 C39 6, 44 8, 44 15 Z" fill={p.skin} />
                <rect x="25" y="9" width="10" height="2" fill="#ffffff" fillOpacity="0.35" />
                <rect x="27" y="11" width="6" height="1" fill="#ffffff" fillOpacity="0.22" />
                <rect x="19" y="16" width="2" height="6" fill={p.hair} />
                <rect x="43" y="16" width="2" height="6" fill={p.hair} />
              </>
            ) : (
              <>
                {/* Forehead Highlight */}
                <rect x="25" y="16" width="14" height="3" fill="#ffffff" fillOpacity="0.16" />
                {/* 90s Hair with 16-bit Volume & Highlight */}
                <path d="M18 20 L19 10 L25 6 L40 6 L45 10 L46 20 L43 20 L42 14 L22 14 L21 20 Z" fill={p.hair} />
                <rect x="23" y="8" width="14" height="2" fill={p.hairHi} />
                <rect x="26" y="10" width="8" height="2" fill={p.hairHi} />
              </>
            )}

            {/* Eyebrows */}
            <rect x="23" y="20" width="6" height="1.5" fill={p.hair} />
            <rect x="35" y="20" width="6" height="1.5" fill={p.hair} />

            {/* Eyes, Prescription Glasses, or Racing Shades */}
            {p.shades ? (
              <>
                <rect x="22" y="21" width="8" height="4" fill="#0f172a" />
                <rect x="34" y="21" width="8" height="4" fill="#0f172a" />
                <rect x="30" y="22" width="4" height="1.5" fill="#94a3b8" />
                <rect x="23" y="22" width="3" height="1" fill="#38bdf8" />
                <rect x="35" y="22" width="3" height="1" fill="#38bdf8" />
              </>
            ) : p.eastAsianEyes ? (
              <>
                {/* 16-bit East Asian almond eyes */}
                <rect x="23" y="22.5" width="5" height="1.4" fill="#0f172a" />
                <rect x="36" y="22.5" width="5" height="1.4" fill="#0f172a" />
                <rect x="24" y="22.5" width="1.5" height="1" fill="#f8fafc" fillOpacity="0.65" />
                <rect x="37" y="22.5" width="1.5" height="1" fill="#f8fafc" fillOpacity="0.65" />
              </>
            ) : (
              <>
                {/* Eye whites + Pupils */}
                <rect x="23" y="22" width="5" height="2" fill="#f8fafc" />
                <rect x="36" y="22" width="5" height="2" fill="#f8fafc" />
                <rect x="25" y="22" width="2" height="2" fill="#0f172a" />
                <rect x="38" y="22" width="2" height="2" fill="#0f172a" />
                {p.prescription && (
                  <>
                    {/* Prescription Glasses Frame + Subtle Lens Glint */}
                    <rect x="21" y="20.5" width="9" height="5" fill="#bae6fd" fillOpacity="0.22" stroke="#1e293b" strokeWidth="1.2" />
                    <rect x="34" y="20.5" width="9" height="5" fill="#bae6fd" fillOpacity="0.22" stroke="#1e293b" strokeWidth="1.2" />
                    <rect x="30" y="22" width="4" height="1.2" fill="#1e293b" />
                    <rect x="20" y="22" width="1.5" height="1" fill="#1e293b" />
                    <rect x="42.5" y="22" width="1.5" height="1" fill="#1e293b" />
                  </>
                )}
              </>
            )}

            {/* Nose Bridge & Shadow */}
            <rect x="31" y="22" width="2" height="6" fill={p.skinDark} />
            <rect x="30" y="27" width="4" height="1" fill={p.skinDark} />

            {/* Determined 90s Smirk */}
            <rect x="28" y="31" width="8" height="1.5" fill="#7c2d12" />
            <rect x="29" y="31" width="5" height="1" fill="#f8fafc" fillOpacity="0.6" />
          </>
        )}

        {/* CRT Scanline Gloss */}
        <rect x="0" y="0" width="64" height="64" fill="none" stroke="#0f172a" strokeWidth="2" />
      </svg>
    </div>
  );
}

function detectCircuitIdFromEvent(ev) {
  if (!ev) return 'monza';
  const raw = `${ev.id || ''} ${ev.track || ''}`.toLowerCase();
  const matched = LMU_CIRCUITS.find(
    (c) => raw.includes(c.id) || raw.includes(c.shortName.toLowerCase())
  );
  return matched ? matched.id : 'monza';
}

function MiniPirelliTire({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="shrink-0 drop-shadow-sm"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10.5" fill="#0b0f17" stroke="#334155" strokeWidth="1" />
      <path
        d="M5.2 6.8 A9 9 0 0 1 18.8 6.8"
        fill="none"
        stroke="#eab308"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M18.8 17.2 A9 9 0 0 1 5.2 17.2"
        fill="none"
        stroke="#eab308"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="5.2" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
      <circle cx="12" cy="12" r="1.8" fill="#eab308" />
    </svg>
  );
}

const INITIAL_NEXT_EVENT = buildLmuWeekendCalendar().find((e) => e.status === 'next');

const DEFAULT_PARAMS = {
  carClass: 'LMGT3',
  carId: 'porsche-911-lmgt3',
  circuitId: detectCircuitIdFromEvent(INITIAL_NEXT_EVENT),
  sessionStart: '14:00',
  raceDurationStr: '06:00',
  lapTimeStr: '01:45.320',
  tankCapacityL: 100,
  fuelPerLapL: 3.1,
  virtualEnergyPerLapPct: 2.1,
  fpDurationMin: 5,
  qualyDurationMin: 15,
  availableTires: 24,
  pitTime4TiresSec: 45,
  pitTime2TiresSec: 35,
  pitTimeFuelOnlySec: 25,
  pitTimeDriverOnlySec: 15,
};

const DEFAULT_FULL_TIRES = { FL: 100, FR: 100, RL: 100, RR: 100 };

const DEFAULT_PRE_SESSIONS = {
  fp: {
    driver: 'Leandro Agiani',
    tiresStart: { FL: 100, FR: 100, RL: 100, RR: 100 },
    tiresEnd: { FL: 100, FR: 100, RL: 100, RR: 100 },
  },
  qualy: {
    driver: 'Bruno Aguiar',
    tiresStart: { FL: 100, FR: 100, RL: 100, RR: 100 },
    tiresEnd: { FL: 88, FR: 84, RL: 90, RR: 89 },
    tiresEndEnabled: false,
  },
};

const DEFAULT_STINT_OVERRIDES = {
  1: {
    driver: 'Leandro Agiani',
    pitScenario: '4_tires_fuel',
    tiresStart: { FL: 100, FR: 100, RL: 100, RR: 100 },
    tiresEnd: { FL: 68, FR: 62, RL: 74, RR: 72 },
    tiresEndEnabled: false,
  },
  2: {
    driver: 'Bruno Aguiar',
    pitScenario: '2_tires_fuel',
    tiresStart: { FL: 100, FR: 100, RL: 100, RR: 100 },
    tiresEnd: { FL: 71, FR: 66, RL: 77, RR: 75 },
    tiresEndEnabled: false,
  },
  3: {
    driver: 'Erich Terezzino',
    pitScenario: 'fuel_only',
    tiresStart: { FL: 100, FR: 100, RL: 100, RR: 100 },
    tiresEnd: { FL: 54, FR: 48, RL: 61, RR: 58 },
    tiresEndEnabled: false,
  },
  4: {
    driver: 'Iuri Soares',
    pitScenario: '4_tires_fuel',
    tiresStart: { FL: 100, FR: 100, RL: 100, RR: 100 },
    tiresEnd: { FL: 69, FR: 64, RL: 75, RR: 73 },
    tiresEndEnabled: false,
  },
  5: {
    driver: 'Vitor Justen',
    pitScenario: 'driver_swap_only',
    tiresStart: { FL: 'keep', FR: 'keep', RL: 'keep', RR: 'keep' },
    tiresEnd: { FL: 59, FR: 52, RL: 66, RR: 63 },
    tiresEndEnabled: false,
  },
  6: {
    driver: 'Paulo Afonso',
    pitScenario: 'fuel_only',
    tiresStart: { FL: 100, FR: 100, RL: 100, RR: 100 },
    tiresEnd: { FL: 65, FR: 60, RL: 72, RR: 70 },
    tiresEndEnabled: false,
  },
};

/**
 * Parses lap time string in format MM:SS.mmm, MM:SS, or seconds into total seconds.
 */
function parseLapTimeToSeconds(str) {
  if (!str || typeof str !== 'string') return 105.32;
  const trimmed = str.trim();
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    const mins = parseFloat(parts[0]);
    const secs = parseFloat(parts[1]);
    if (!Number.isNaN(mins) && !Number.isNaN(secs) && mins >= 0 && secs >= 0) {
      const total = mins * 60 + secs;
      return total > 5 ? total : 105.32;
    }
  } else {
    const secs = parseFloat(trimmed);
    if (!Number.isNaN(secs) && secs > 5) return secs;
  }
  return 105.32;
}

/**
 * Parses HH:MM into minutes from midnight.
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return 14 * 60;
  const [h, m] = timeStr.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 14 * 60;
  return h * 60 + m;
}

/**
 * Parses HH:MM duration string (e.g. "06:00", "24:00") into total minutes.
 */
function parseDurationHHMMToMinutes(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') return 360;
  const trimmed = durationStr.trim();
  if (trimmed.includes(':')) {
    const [hStr, mStr] = trimmed.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (!Number.isNaN(h) && !Number.isNaN(m) && h >= 0 && m >= 0 && m < 60) {
      const total = h * 60 + m;
      return total > 0 ? total : 360;
    }
  } else {
    const mins = parseInt(trimmed, 10);
    if (!Number.isNaN(mins) && mins > 0) return mins;
  }
  return 360;
}

/**
 * Formats total minutes (may be fractional) into HH:MM (24h wrap).
 */
function formatMinutesToHHMM(totalMinutes) {
  const rounded = Math.round(totalMinutes);
  const wrapped = ((rounded % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Returns tire color classes based on remaining rubber percentage.
 * > 75%: emerald, 50% - 75%: amber, < 50%: red
 */
function getTireBadgeClasses(pct) {
  if (pct > 75) {
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:border-emerald-400';
  }
  if (pct >= 50) {
    return 'bg-amber-500/15 text-amber-400 border-amber-500/40 hover:border-amber-400';
  }
  return 'bg-red-500/15 text-red-400 border-red-500/40 hover:border-red-400';
}

function getTireBarColor(pct) {
  if (pct > 75) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function getTireTextColor(pct) {
  if (pct > 75) return 'text-emerald-400';
  if (pct >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function getPitTimeSeconds(scenarioId, params) {
  switch (scenarioId) {
    case '4_tires_fuel':
      return Math.max(0, Number(params.pitTime4TiresSec) || 0);
    case '2_tires_fuel':
      return Math.max(0, Number(params.pitTime2TiresSec) || 0);
    case 'fuel_only':
      return Math.max(0, Number(params.pitTimeFuelOnlySec) || 0);
    case 'driver_swap_only':
      return Math.max(0, Number(params.pitTimeDriverOnlySec) || 0);
    default:
      return 0;
  }
}

function StartTireToggleButton({ corner, tireMeta, onToggle }) {
  const mode = tireMeta?.mode || 'new';
  const tireId = tireMeta?.tireId || '';
  const pct = tireMeta?.pct;
  const sourceLabel = tireMeta?.sourceLabel;

  let displayValue = 'NOVO';
  if (mode === 'keep') {
    displayValue = pct === 'ND' || pct === null || pct === undefined ? 'MANTER' : `MANT ${pct}%`;
  } else if (mode === 'used') {
    displayValue = pct === 'ND' || pct === null || pct === undefined ? 'ND' : `${pct}%`;
  }

  const colorClasses =
    mode === 'new'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-500/25'
      : mode === 'keep'
        ? 'bg-sky-500/15 text-sky-300 border-sky-500/40 hover:border-sky-400 hover:bg-sky-500/25'
        : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:border-amber-400 hover:bg-amber-500/25';

  const tooltip =
    mode === 'new'
      ? `Pneu ${corner} ${tireId} (NOVO) — Clique para alternar (Manter / Usado)`
      : mode === 'keep'
        ? `Pneu ${corner} ${tireId} (MANTIDO de ${sourceLabel || 'stint anterior'} • ${pct === 'ND' ? 'ND' : `${pct}%`
        }) — Clique para usar outro pneu usado`
        : `Pneu ${corner} ${tireId} (USADO • ${sourceLabel ? `${displayValue} de ${sourceLabel}` : displayValue
        }) — Clique para trocar por NOVO`;

  return (
    <button
      type="button"
      onClick={onToggle}
      title={tooltip}
      className={`flex w-full flex-col items-center justify-center rounded-md border px-2 py-1.5 text-xs font-mono font-semibold transition-all cursor-pointer min-w-[58px] ${colorClasses}`}
    >
      <span className="text-[10px] uppercase tracking-wider opacity-90 leading-none">
        {corner} {tireId}
      </span>
      <span className="tabular-nums leading-tight mt-1 text-[11px] font-bold">{displayValue}</span>
    </button>
  );
}

function TireBadgeEditor({ corner, tireId, value, onChange }) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const numericVal = Math.min(100, Math.max(0, Number(value) || 0));

  return (
    <div className="relative flex flex-col" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title={`Editar desgaste ${corner} ${tireId || ''} (${numericVal}%)`}
        className={`flex w-full flex-col items-center justify-center rounded-md border px-2 py-1.5 text-xs font-mono font-semibold transition-all cursor-pointer min-w-[58px] ${getTireBadgeClasses(
          numericVal
        )}`}
      >
        <span className="text-[10px] uppercase tracking-wider opacity-90 leading-none">
          {corner} {tireId || ''}
        </span>
        <span className="tabular-nums leading-tight mt-1 text-[11px] font-bold">{numericVal}%</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-1.5 sm:block sm:bg-transparent sm:p-0"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-64 sm:w-48 rounded-xl sm:rounded-lg border border-slate-600 bg-slate-900 p-4 sm:p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-200">
              <span>
                Pneu {corner} {tireId || ''}
              </span>
              <div className="flex items-center gap-2">
                <span className={`font-mono tabular-nums ${getTireTextColor(numericVal)}`}>
                  {numericVal}%
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="sm:hidden text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={numericVal}
              onChange={(e) => onChange(Number(e.target.value))}
              className="mb-3 sm:mb-2 w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                max="100"
                value={numericVal}
                onChange={(e) => {
                  const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                  onChange(v);
                }}
                className="w-16 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-mono text-slate-100 focus:border-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  onChange(100);
                  setOpen(false);
                }}
                className="flex-1 rounded bg-emerald-500/20 border border-emerald-500/40 px-2 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors"
              >
                NOVO (100%)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function loadInitialStrategyState() {
  const fallback = {
    params: DEFAULT_PARAMS,
    preSessions: DEFAULT_PRE_SESSIONS,
    stintOverrides: DEFAULT_STINT_OVERRIDES,
    eventSignups: {},
    loadedFromUrl: false,
  };

  try {
    const searchParams = new URLSearchParams(window.location.search);
    const encodedState = searchParams.get('s');
    if (encodedState) {
      const decompressed = LZString.decompressFromEncodedURIComponent(encodedState);
      if (decompressed) {
        const parsed = JSON.parse(decompressed);
        if (parsed && typeof parsed === 'object') {
          const merged = {
            params: { ...DEFAULT_PARAMS, ...(parsed.params || {}) },
            preSessions: { ...DEFAULT_PRE_SESSIONS, ...(parsed.preSessions || {}) },
            stintOverrides: parsed.stintOverrides || DEFAULT_STINT_OVERRIDES,
            eventSignups: parsed.eventSignups || {},
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          window.history.replaceState({}, '', window.location.pathname);
          return { ...merged, loadedFromUrl: true };
        }
      }
    }
  } catch {
    // ignore malformed URL state and fall back to localStorage
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return {
          params: { ...DEFAULT_PARAMS, ...(parsed.params || {}) },
          preSessions: { ...DEFAULT_PRE_SESSIONS, ...(parsed.preSessions || {}) },
          stintOverrides: parsed.stintOverrides || DEFAULT_STINT_OVERRIDES,
          eventSignups: parsed.eventSignups || {},
          loadedFromUrl: false,
        };
      }
    }
  } catch {
    // ignore storage errors
  }

  return fallback;
}

export default function App() {
  const initialStateRef = useRef(null);
  if (!initialStateRef.current) {
    initialStateRef.current = loadInitialStrategyState();
  }

  const [params, setParams] = useState(() => initialStateRef.current.params);
  const [preSessions, setPreSessions] = useState(() => initialStateRef.current.preSessions);
  const [stintOverrides, setStintOverrides] = useState(
    () => initialStateRef.current.stintOverrides
  );
  const [eventSignups, setEventSignups] = useState(
    () => initialStateRef.current.eventSignups || {}
  );

  const [copied, setCopied] = useState(false);
  const [mobileParamsOpen, setMobileParamsOpen] = useState(true);
  const [mobileFuelOpen, setMobileFuelOpen] = useState(true);
  const [mobilePage, setMobilePage] = useState(1);
  const prevMobilePageRef = useRef(1);
  const mobilePagerRef = useRef(null);
  const mobilePagerInitRef = useRef(false);
  const mobileSessionStartRef = useRef(null);
  const mobileAvailableTiresRef = useRef(null);
  const mobileCalendarRef = useRef(null);
  const desktopCalendarRef = useRef(null);
  const [selectedTireCornerModal, setSelectedTireCornerModal] = useState(null);
  const [circuitModalOpen, setCircuitModalOpen] = useState(false);
  const [calendarEventModal, setCalendarEventModal] = useState(null);
  const [signupDriverDraft, setSignupDriverDraft] = useState(() => DRIVERS[0]);
  const [signupClassesDraft, setSignupClassesDraft] = useState(['Hypercar']);
  const [headerEventIdx, setHeaderEventIdx] = useState(0);
  const [collapsedStints, setCollapsedStints] = useState({});
  const mobileInitCollapsedRef = useRef(false);
  const [toast, setToast] = useState(() =>
    initialStateRef.current.loadedFromUrl
      ? { message: 'Estratégia carregada pelo link compartilhado!', type: 'success' }
      : null
  );

  const [roomPin, setRoomPin] = useState(() => {
    try {
      return localStorage.getItem(ROOM_PIN_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [pinDraft, setPinDraft] = useState(roomPin);
  const [liveRoomEnabled, setLiveRoomEnabled] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState('local'); // 'local' | 'connecting' | 'live' | 'error'
  const [livePeersCount, setLivePeersCount] = useState(1);

  const isApplyingRemoteRef = useRef(false);
  const syncTimeoutRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (initialStateRef.current?.loadedFromUrl) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ params, preSessions, stintOverrides, eventSignups })
      );
    } catch {
      // ignore quota errors
    }
  }, [params, preSessions, stintOverrides, eventSignups]);

  // Supabase Realtime Subscription (when configured and live room enabled)
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !liveRoomEnabled || !roomPin.trim()) {
      setSyncStatus('local');
      setLivePeersCount(1);
      return;
    }

    const activePin = roomPin.trim().toUpperCase();
    let cancelled = false;
    setSyncStatus('connecting');

    async function initRoom() {
      try {
        const { data, error } = await supabase
          .from('race_strategies')
          .select('strategy_data, updated_by')
          .eq('room_pin', activePin)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          setSyncStatus('error');
          showToast('Erro ao conectar na sala ao vivo. Usando Modo Local.', 'error');
          return;
        }

        if (data?.strategy_data) {
          isApplyingRemoteRef.current = true;
          const remote = data.strategy_data;
          if (remote.params) setParams({ ...DEFAULT_PARAMS, ...remote.params });
          if (remote.preSessions) setPreSessions({ ...DEFAULT_PRE_SESSIONS, ...remote.preSessions });
          if (remote.stintOverrides) setStintOverrides(remote.stintOverrides);
          if (remote.eventSignups) setEventSignups(remote.eventSignups);
          if (remote.eventSignups) setEventSignups(remote.eventSignups);
          setTimeout(() => {
            isApplyingRemoteRef.current = false;
          }, 50);
        } else {
          await supabase.from('race_strategies').upsert(
            {
              room_pin: activePin,
              strategy_data: { params, preSessions, stintOverrides, eventSignups },
              updated_by: CLIENT_INSTANCE_ID,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'room_pin' }
          );
        }
      } catch {
        if (!cancelled) setSyncStatus('error');
      }
    }

    initRoom();

    const channel = supabase
      .channel(`pitwall-room-${activePin}`, {
        config: {
          presence: {
            key: CLIENT_INSTANCE_ID,
          },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'race_strategies',
          filter: `room_pin=eq.${activePin}`,
        },
        (payload) => {
          const record = payload.new;
          if (!record?.strategy_data || record.updated_by === CLIENT_INSTANCE_ID) return;
          isApplyingRemoteRef.current = true;
          const remote = record.strategy_data;
          if (remote.params) setParams({ ...DEFAULT_PARAMS, ...remote.params });
          if (remote.preSessions) setPreSessions({ ...DEFAULT_PRE_SESSIONS, ...remote.preSessions });
          if (remote.stintOverrides) setStintOverrides(remote.stintOverrides);
          if (remote.eventSignups) setEventSignups(remote.eventSignups);
          setTimeout(() => {
            isApplyingRemoteRef.current = false;
          }, 50);
        }
      )
      .on('presence', { event: 'sync' }, () => {
        if (cancelled) return;
        const state = channel.presenceState();
        setLivePeersCount(Math.max(1, Object.keys(state).length));
      })
      .subscribe(async (status) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          setSyncStatus('live');
          try {
            await channel.track({ online_at: new Date().toISOString() });
          } catch {
            // Ignore presence track errors
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setSyncStatus('error');
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [liveRoomEnabled, roomPin]);

  // Debounced push of local edits to Supabase when live room is active
  useEffect(() => {
    if (
      !isSupabaseConfigured ||
      !supabase ||
      !liveRoomEnabled ||
      syncStatus !== 'live' ||
      isApplyingRemoteRef.current
    ) {
      return;
    }

    const activePin = roomPin.trim().toUpperCase();
    if (!activePin) return;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        await supabase.from('race_strategies').upsert(
          {
            room_pin: activePin,
            strategy_data: { params, preSessions, stintOverrides, eventSignups },
            updated_by: CLIENT_INSTANCE_ID,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'room_pin' }
        );
      } catch {
        // Keep local state intact on transient network failure
      }
    }, 400);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [params, preSessions, stintOverrides, eventSignups, liveRoomEnabled, syncStatus, roomPin]);

  const handleParamChange = (key, value) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setParams(DEFAULT_PARAMS);
    setPreSessions(DEFAULT_PRE_SESSIONS);
    setStintOverrides(DEFAULT_STINT_OVERRIDES);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  // Calculations: Fuel Ratio & Stint Autonomy
  const telemetry = useMemo(() => {
    const lapTimeSec = parseLapTimeToSeconds(params.lapTimeStr);
    const tankL = Math.max(1, Number(params.tankCapacityL) || 100);
    const fuelPerLap = Math.max(0.1, Number(params.fuelPerLapL) || 3.1);
    const energyPerLap = Math.max(0.1, Number(params.virtualEnergyPerLapPct) || 2.1);

    const fuelRatio = fuelPerLap / energyPerLap;
    const maxLapsByFuel = Math.floor(tankL / fuelPerLap);
    const maxLapsByEnergy = Math.floor(100 / energyPerLap);
    const maxStintLaps = Math.max(1, Math.min(maxLapsByFuel, maxLapsByEnergy));
    const limitingFactor = maxLapsByFuel <= maxLapsByEnergy ? 'Tanque' : 'Energia Virtual';
    const maxStintMin = (maxStintLaps * lapTimeSec) / 60;

    return {
      lapTimeSec,
      fuelRatio,
      maxLapsByFuel,
      maxLapsByEnergy,
      maxStintLaps,
      limitingFactor,
      maxStintMin,
    };
  }, [params]);

  // Build Schedule: Free Practice -> Qualy -> Dynamic Race Stints
  const schedule = useMemo(() => {
    const rows = [];
    let cursorMin = parseTimeToMinutes(params.sessionStart);

    const fpDur = Math.max(0, Number(params.fpDurationMin) || 0);
    const fpLaps = Math.floor((fpDur * 60) / telemetry.lapTimeSec);
    rows.push({
      id: 'fp',
      type: 'fp',
      label: 'Free Practice',
      durationMin: fpDur,
      laps: fpLaps,
      startMin: cursorMin,
      endMin: cursorMin + fpDur,
      driver: preSessions.fp.driver,
      pitScenario: null,
      pitDurationSec: 0,
      tiresStart: DEFAULT_FULL_TIRES,
      tiresEnd: DEFAULT_FULL_TIRES,
    });
    cursorMin += fpDur;

    const qualyDur = Math.max(0, Number(params.qualyDurationMin) || 0);
    const qualyLaps = Math.floor((qualyDur * 60) / telemetry.lapTimeSec);
    rows.push({
      id: 'qualy',
      type: 'qualy',
      label: 'Qualy',
      durationMin: qualyDur,
      laps: qualyLaps,
      startMin: cursorMin,
      endMin: cursorMin + qualyDur,
      driver: preSessions.qualy.driver,
      pitScenario: null,
      pitDurationSec: 0,
      tiresStart: preSessions.qualy.tiresStart || DEFAULT_FULL_TIRES,
      tiresEnd: preSessions.qualy.tiresEnd || preSessions.qualy.tires || { FL: 88, FR: 84, RL: 90, RR: 89 },
      tiresEndEnabled: Boolean(preSessions.qualy.tiresEndEnabled),
    });
    cursorMin += qualyDur;

    const totalRaceMin = parseDurationHHMMToMinutes(params.raceDurationStr);
    let remainingRaceMin = totalRaceMin;
    let stintNum = 1;
    const maxStintsGuard = 60;

    while (remainingRaceMin > 0.05 && stintNum <= maxStintsGuard) {
      const override = stintOverrides[stintNum] || {};
      const defaultDriver = DRIVERS[(stintNum - 1) % Math.min(6, DRIVERS.length)];
      const driver = override.driver || defaultDriver;
      const pitScenario = override.pitScenario || '4_tires_fuel';
      const tiresStart = override.tiresStart || DEFAULT_FULL_TIRES;
      const tiresEnd = override.tiresEnd || override.tires || { FL: 72, FR: 68, RL: 76, RR: 74 };
      const tiresEndEnabled = Boolean(override.tiresEndEnabled);

      const rawStintMin = Math.min(telemetry.maxStintMin, remainingRaceMin);
      const stintLaps = Math.max(1, Math.round((rawStintMin * 60) / telemetry.lapTimeSec));
      const startMin = cursorMin;
      const endMin = startMin + rawStintMin;

      const isLastStint = remainingRaceMin - rawStintMin <= 0.05;
      const pitDurationSec = isLastStint ? 0 : getPitTimeSeconds(pitScenario, params);
      const pitDurationMin = pitDurationSec / 60;

      rows.push({
        id: `stint_${stintNum}`,
        type: 'race',
        stintNum,
        label: `Stint ${String(stintNum).padStart(2, '0')}`,
        durationMin: rawStintMin,
        laps: stintLaps,
        startMin,
        endMin,
        driver,
        pitScenario,
        pitDurationSec,
        isLastStint,
        tiresStart,
        tiresEnd,
        tiresEndEnabled,
      });

      remainingRaceMin -= rawStintMin;
      if (!isLastStint) {
        // Advance clock by pitstop time and deduct pit time from remaining race clock
        cursorMin = endMin + pitDurationMin;
        remainingRaceMin = Math.max(0, remainingRaceMin - pitDurationMin);
      } else {
        cursorMin = endMin;
      }

      stintNum += 1;
    }

    return rows;
  }, [params, preSessions, stintOverrides, telemetry]);

  // Sequential physical tire tracking (#1, #2, #3...) individually across all tires
  const { enrichedSchedule, tireBankByCorner } = useMemo(() => {
    let globalTireNum = 1;
    const bank = { FL: [], FR: [], RL: [], RR: [] };
    const prevMounted = { FL: null, FR: null, RL: null, RR: null };

    const enriched = schedule.map((row) => {
      if (row.type === 'fp') {
        return { ...row, startTireMeta: null, endTireMeta: null };
      }

      const startTireMeta = {};
      const endTireMeta = {};

      TIRE_CORNERS.forEach(({ key }) => {
        const rawStart = row.tiresStart?.[key];
        const canKeep = Boolean(prevMounted[key]);
        const isKeep = rawStart === 'keep' && canKeep;
        const isNew = rawStart === 100 || rawStart === 'new';

        if (isNew) {
          const num = globalTireNum++;
          const tire = {
            num,
            id: `#${num}`,
            currentPct: row.tiresEndEnabled
              ? Math.min(100, Math.max(0, Number(row.tiresEnd?.[key]) || 0))
              : null,
            lastSource: row.label,
            hasRecordedWear: Boolean(row.tiresEndEnabled),
          };
          bank[key].push(tire);
          prevMounted[key] = tire;
          startTireMeta[key] = {
            mode: 'new',
            canKeep,
            tireNum: num,
            tireId: `#${num}`,
            pct: 100,
            sourceLabel: null,
          };
          endTireMeta[key] = { tireNum: num, tireId: `#${num}` };
        } else if (isKeep) {
          const chosen = prevMounted[key];
          const startPct = chosen.hasRecordedWear ? chosen.currentPct : 'ND';
          const sourceLabel = chosen.lastSource;
          if (row.tiresEndEnabled) {
            chosen.currentPct = Math.min(100, Math.max(0, Number(row.tiresEnd?.[key]) || 0));
            chosen.lastSource = row.label;
            chosen.hasRecordedWear = true;
          }
          prevMounted[key] = chosen;
          startTireMeta[key] = {
            mode: 'keep',
            canKeep,
            tireNum: chosen.num,
            tireId: chosen.id,
            pct: startPct,
            sourceLabel,
          };
          endTireMeta[key] = { tireNum: chosen.num, tireId: chosen.id };
        } else {
          const recorded = bank[key].filter((t) => t.hasRecordedWear);
          let chosen = null;
          if (recorded.length > 0) {
            chosen = recorded.reduce(
              (best, t) => (t.currentPct > best.currentPct ? t : best),
              recorded[0]
            );
          } else if (bank[key].length > 0) {
            chosen = bank[key][bank[key].length - 1];
          }

          if (chosen) {
            const startPct = chosen.hasRecordedWear ? chosen.currentPct : 'ND';
            const sourceLabel = chosen.lastSource;
            if (row.tiresEndEnabled) {
              chosen.currentPct = Math.min(100, Math.max(0, Number(row.tiresEnd?.[key]) || 0));
              chosen.lastSource = row.label;
              chosen.hasRecordedWear = true;
            }
            prevMounted[key] = chosen;
            startTireMeta[key] = {
              mode: 'used',
              canKeep,
              tireNum: chosen.num,
              tireId: chosen.id,
              pct: startPct,
              sourceLabel,
            };
            endTireMeta[key] = { tireNum: chosen.num, tireId: chosen.id };
          } else {
            startTireMeta[key] = {
              mode: 'used',
              canKeep,
              tireNum: null,
              tireId: '—',
              pct: 'ND',
              sourceLabel: null,
            };
            endTireMeta[key] = { tireNum: null, tireId: '—' };
          }
        }
      });

      return {
        ...row,
        startTireMeta,
        endTireMeta,
      };
    });

    return { enrichedSchedule: enriched, tireBankByCorner: bank };
  }, [schedule]);

  // Tire Reuse Analyzer: ranks physical tires (#1, #2...) by their latest remaining %
  const tireRecommendations = useMemo(() => {
    const result = {};

    TIRE_CORNERS.forEach(({ key, label }) => {
      const candidates = tireBankByCorner[key]
        .filter((t) => t.hasRecordedWear)
        .map((t) => ({
          id: `${key}-${t.id}`,
          tireId: t.id,
          sourceLabel: t.lastSource,
          pct: t.currentPct,
        }))
        .sort((a, b) => b.pct - a.pct);

      const best = candidates[0] || null;
      const secondBest = candidates[1] || null;

      result[key] = {
        key,
        label,
        best,
        secondBest,
        all: candidates,
      };
    });

    return result;
  }, [tireBankByCorner]);

  const canAssignDriver = (targetRowId, nextDriver) => {
    if (nextDriver === 'ND') return true;
    const nextSet = new Set(
      schedule
        .map((s) => (s.id === targetRowId ? nextDriver : s.driver))
        .filter((d) => Boolean(d) && d !== 'ND')
    );
    return nextSet.size <= 6;
  };

  const notifyMaxDriversLimit = () => {
    setToast({
      message: 'Limite do simulador: máximo de 6 pilotos diferentes por sessão.',
      type: 'warning',
    });
  };

  const updatePreSession = (sessionKey, field, value) => {
    if (field === 'driver' && !canAssignDriver(sessionKey, value)) {
      notifyMaxDriversLimit();
      return;
    }
    setPreSessions((prev) => ({
      ...prev,
      [sessionKey]: {
        ...prev[sessionKey],
        [field]: value,
      },
    }));
  };

  const updatePreSessionTire = (sessionKey, phase, corner, pct) => {
    setPreSessions((prev) => {
      const current = prev[sessionKey];
      const existingPhase = current[phase] || current.tires || DEFAULT_FULL_TIRES;
      return {
        ...prev,
        [sessionKey]: {
          ...current,
          [phase]: {
            ...existingPhase,
            [corner]: pct,
          },
        },
      };
    });
  };

  const updateRaceStint = (stintNum, field, value) => {
    if (field === 'driver' && !canAssignDriver(`stint-${stintNum}`, value)) {
      notifyMaxDriversLimit();
      return;
    }
    setStintOverrides((prev) => {
      const current = prev[stintNum] || {
        driver: DRIVERS[(stintNum - 1) % DRIVERS.length],
        pitScenario: '4_tires_fuel',
        tiresStart: DEFAULT_FULL_TIRES,
        tiresEnd: { FL: 72, FR: 68, RL: 76, RR: 74 },
      };
      return {
        ...prev,
        [stintNum]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const updateRaceStintTire = (stintNum, phase, corner, pct) => {
    setStintOverrides((prev) => {
      const current = prev[stintNum] || {
        driver: DRIVERS[(stintNum - 1) % DRIVERS.length],
        pitScenario: '4_tires_fuel',
        tiresStart: DEFAULT_FULL_TIRES,
        tiresEnd: { FL: 72, FR: 68, RL: 76, RR: 74 },
      };
      const existingPhase =
        current[phase] ||
        (phase === 'tiresStart' ? DEFAULT_FULL_TIRES : current.tires || { FL: 72, FR: 68, RL: 76, RR: 74 });
      return {
        ...prev,
        [stintNum]: {
          ...current,
          [phase]: {
            ...existingPhase,
            [corner]: pct,
          },
        },
      };
    });
  };

  const getBestUsedTireForCorner = (rowIndex, corner) => {
    const previousRows = schedule
      .slice(0, rowIndex)
      .filter((r) => r.type !== 'fp' && r.tiresEndEnabled);
    if (previousRows.length === 0) return null;

    let best = null;
    previousRows.forEach((prevRow) => {
      const pct = Math.min(100, Math.max(0, Number(prevRow.tiresEnd?.[corner]) || 0));
      if (!best || pct > best.pct) {
        best = { pct, sourceLabel: prevRow.label };
      }
    });
    return best;
  };

  const selectedCar = useMemo(() => {
    return (
      LMU_CARS.find((c) => c.id === params.carId) ||
      LMU_CARS.find((c) => c.classId === params.carClass) ||
      LMU_CARS[0]
    );
  }, [params.carId, params.carClass]);

  const selectedClassMeta = useMemo(() => {
    return (
      LMU_CAR_CLASSES.find((cls) => cls.id === selectedCar.classId) ||
      LMU_CAR_CLASSES[0]
    );
  }, [selectedCar]);

  const carsInSelectedClass = useMemo(() => {
    return LMU_CARS.filter((c) => c.classId === (params.carClass || selectedCar.classId));
  }, [params.carClass, selectedCar]);

  const selectedCircuit = useMemo(() => {
    return LMU_CIRCUITS.find((c) => c.id === params.circuitId) || LMU_CIRCUITS[3];
  }, [params.circuitId]);

  useEffect(() => {
    if (
      !mobileInitCollapsedRef.current &&
      typeof window !== 'undefined' &&
      window.innerWidth < 768 &&
      enrichedSchedule.length > 0
    ) {
      mobileInitCollapsedRef.current = true;
      const allCollapsed = {};
      enrichedSchedule.forEach((r) => {
        allCollapsed[r.id] = true;
      });
      setCollapsedStints(allCollapsed);
    }
  }, [enrichedSchedule]);

  const goToMobilePage = (pageIdx) => {
    setMobilePage(pageIdx);
    if (mobilePagerRef.current) {
      mobilePagerRef.current.scrollTo({
        left: pageIdx * mobilePagerRef.current.clientWidth,
        behavior: 'smooth',
      });
    }
  };

  const toggleMobilePage = (targetPage) => {
    if (mobilePage === targetPage) {
      const fallback = prevMobilePageRef.current !== targetPage ? prevMobilePageRef.current : 1;
      goToMobilePage(fallback);
    } else {
      prevMobilePageRef.current = mobilePage;
      goToMobilePage(targetPage);
    }
  };

  const goToMobileParamField = (fieldRef) => {
    prevMobilePageRef.current = mobilePage;
    goToMobilePage(0);
    setTimeout(() => {
      const el = fieldRef?.current;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
      if (typeof el.showPicker === 'function') {
        try {
          el.showPicker();
        } catch {
          // Ignore if browser blocks programmatic showPicker
        }
      }
      if (typeof el.select === 'function' && el.type === 'number') {
        el.select();
      }
    }, 320);
  };

  const handleMobilePagerScroll = () => {
    const el = mobilePagerRef.current;
    if (!el || !el.clientWidth) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== mobilePage && idx >= 0 && idx <= 2) {
      setMobilePage(idx);
    }
  };

  useEffect(() => {
    const el = mobilePagerRef.current;
    if (!mobilePagerInitRef.current && el && el.clientWidth > 0) {
      mobilePagerInitRef.current = true;
      el.scrollLeft = el.clientWidth; // Open on center section (Stints)
    }
  }, []);

  const toggleStintCollapse = (rowId) => {
    setCollapsedStints((prev) => ({ ...prev, [rowId]: !prev[rowId] }));
  };

  const areAllStintsCollapsed =
    enrichedSchedule.length > 0 && enrichedSchedule.every((r) => Boolean(collapsedStints[r.id]));

  const toggleAllStintsCollapse = () => {
    if (areAllStintsCollapsed) {
      setCollapsedStints({});
    } else {
      const next = {};
      enrichedSchedule.forEach((r) => {
        next[r.id] = true;
      });
      setCollapsedStints(next);
    }
  };

  const handleShareLink = async () => {
    try {
      const payload = JSON.stringify({ params, preSessions, stintOverrides, eventSignups });
      const compressed = LZString.compressToEncodedURIComponent(payload);
      const shareUrl = `${window.location.origin}${window.location.pathname}?s=${compressed}`;
      await navigator.clipboard.writeText(shareUrl);
      showToast('Link da estratégia copiado!', 'success');
    } catch {
      showToast('Não foi possível copiar o link.', 'error');
    }
  };

  const handleGoToCalendar = () => {
    if (window.innerWidth < 1024) {
      prevMobilePageRef.current = mobilePage;
      goToMobilePage(2);
      setTimeout(() => {
        mobileCalendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 340);
    } else {
      desktopCalendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const openCalendarEventModal = (ev) => {
    setCalendarEventModal(ev);
    const availableDrivers = DRIVERS.filter((d) => d !== 'ND');
    const existingList = eventSignups[ev.id] || [];
    const defaultDriver = availableDrivers[0];
    const existingForDefault = existingList.find((item) => item.driver === defaultDriver);
    setSignupDriverDraft(defaultDriver);
    setSignupClassesDraft(
      existingForDefault?.classes?.length ? existingForDefault.classes : ['LMGT3']
    );
  };

  const toggleSignupClass = (classId) => {
    setSignupClassesDraft((prev) =>
      prev.includes(classId) ? prev.filter((c) => c !== classId) : [...prev, classId]
    );
  };

  const handleSaveEventSignup = (e) => {
    e.preventDefault();
    if (!calendarEventModal || !signupDriverDraft) return;
    if (signupClassesDraft.length === 0) {
      showToast('Selecione pelo menos uma categoria viável.', 'warning');
      return;
    }
    setEventSignups((prev) => {
      const list = prev[calendarEventModal.id] || [];
      const filtered = list.filter((item) => item.driver !== signupDriverDraft);
      return {
        ...prev,
        [calendarEventModal.id]: [
          ...filtered,
          { driver: signupDriverDraft, classes: signupClassesDraft },
        ],
      };
    });
    showToast(`${signupDriverDraft} pré-cadastrado em ${calendarEventModal.track}!`, 'success');
  };

  const handleRemoveEventSignup = (eventId, driverName) => {
    setEventSignups((prev) => ({
      ...prev,
      [eventId]: (prev[eventId] || []).filter((item) => item.driver !== driverName),
    }));
  };

  const handleConnectLiveRoom = (e) => {
    e.preventDefault();
    const cleaned = pinDraft.trim().toUpperCase();
    if (!cleaned) return;
    setRoomPin(cleaned);
    setPinDraft(cleaned);
    try {
      localStorage.setItem(ROOM_PIN_STORAGE_KEY, cleaned);
    } catch {
      // ignore
    }
    if (!isSupabaseConfigured) {
      setLiveRoomEnabled(false);
      setSyncStatus('local');
      setRoomModalOpen(false);
      showToast('Supabase não configurado (.env). Operando em Modo Local.', 'warning');
      return;
    }
    setLiveRoomEnabled(true);
    setRoomModalOpen(false);
    showToast(`Conectando à sala ${cleaned}...`, 'success');
  };

  const handleCopyWhatsApp = async () => {
    const totalRaceMin = parseDurationHHMMToMinutes(params.raceDurationStr);
    const lines = [
      `🏁 *FTR PITWALL — Endurance Strategist (LMU)*`,
      `🛣️ *Circuito:* ${selectedCircuit.name} (${selectedCircuit.country})`,
      `🏎️ *Carro:* [${selectedClassMeta.label}] ${selectedCar.name}`,
      `⏱️ *Início:* ${params.sessionStart} | *Corrida:* ${params.raceDurationStr} (${totalRaceMin} min)`,
      `⛽ *Fuel Ratio:* ${telemetry.fuelRatio.toFixed(2)} L/% | *Autonomia Máx:* ${telemetry.maxStintLaps} voltas (~${telemetry.maxStintMin.toFixed(1)} min)`,
      `⏱️ *Volta Base:* ${params.lapTimeStr}`,
      ``,
      `📋 *CRONOGRAMA DE STINTS:*`,
    ];

    enrichedSchedule.forEach((row) => {
      const timeRange = `${formatMinutesToHHMM(row.startMin)} - ${formatMinutesToHHMM(row.endMin)}`;
      const pitInfo =
        row.type === 'race' && !row.isLastStint
          ? ` | Pit: ${PIT_SCENARIOS.find((p) => p.id === row.pitScenario)?.label} (${row.pitDurationSec}s)`
          : row.isLastStint
            ? ' | 🏁 Bandeira Quadriculada'
            : '';
      if (row.type === 'fp') {
        lines.push(
          `• *${row.label}* (${timeRange}) — ${row.driver} | ${Math.round(row.durationMin)}m (${row.laps}v)\n  🛞 Sem desgaste de pneus`
        );
      } else {
        const fmtStart = (k) => {
          const m = row.startTireMeta?.[k];
          if (!m) return 'NOVO';
          if (m.mode === 'new') return `${m.tireId}:NOVO`;
          if (m.mode === 'keep') return `${m.tireId}:MANTER(${m.pct === 'ND' ? 'ND' : `${m.pct}%`})`;
          return `${m.tireId}:${m.pct === 'ND' ? 'ND' : `${m.pct}%`}`;
        };
        const tiresStartInfo = `FL(${fmtStart('FL')}) FR(${fmtStart('FR')}) RL(${fmtStart('RL')}) RR(${fmtStart('RR')})`;
        const tiresEndInfo = row.tiresEndEnabled
          ? `FL(${row.endTireMeta?.FL?.tireId || ''}:${row.tiresEnd.FL}%) FR(${row.endTireMeta?.FR?.tireId || ''}:${row.tiresEnd.FR}%) RL(${row.endTireMeta?.RL?.tireId || ''}:${row.tiresEnd.RL}%) RR(${row.endTireMeta?.RR?.tireId || ''}:${row.tiresEnd.RR}%)`
          : 'Aguardando registro';
        lines.push(
          `• *${row.label}* (${timeRange}) — ${row.driver} | ${Math.round(row.durationMin)}m (${row.laps}v)${pitInfo}\n  🟢 Início: ${tiresStartInfo}\n  🛞 Fim: ${tiresEndInfo}`
        );
      }
    });

    lines.push(``);
    lines.push(`♻️ *MELHORES PNEUS P/ REAPROVEITAR:*`);
    TIRE_CORNERS.forEach(({ key }) => {
      const rec = tireRecommendations[key];
      if (rec?.best) {
        lines.push(`• *${key} ${rec.best.tireId}:* ${rec.best.pct}% (${rec.best.sourceLabel}) — SUGERIDO`);
      }
    });

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback if clipboard is unavailable
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const raceStints = useMemo(() => schedule.filter((r) => r.type === 'race'), [schedule]);
  const raceStintCount = raceStints.length;
  const totalEstimatedLaps = raceStints.reduce((acc, r) => acc + r.laps, 0);

  const raceDriverStats = useMemo(() => {
    const map = new Map();
    schedule
      .filter((r) => r.type === 'race' && r.driver && r.driver !== 'ND')
      .forEach((r) => {
        const prev = map.get(r.driver) || { driver: r.driver, laps: 0, durationMin: 0 };
        prev.laps += r.laps || 0;
        prev.durationMin += r.durationMin || 0;
        map.set(r.driver, prev);
      });
    return Array.from(map.values())
      .sort((a, b) => b.durationMin - a.durationMin || b.laps - a.laps)
      .slice(0, 6);
  }, [schedule]);

  const usedTiresCount = useMemo(() => {
    return (
      tireBankByCorner.FL.length +
      tireBankByCorner.FR.length +
      tireBankByCorner.RL.length +
      tireBankByCorner.RR.length
    );
  }, [tireBankByCorner]);

  const availableTiresNum = Math.max(0, Number(params.availableTires) || 0);
  const remainingTiresCount = availableTiresNum - usedTiresCount;

  const calendarEvents = useMemo(() => buildLmuWeekendCalendar(), []);
  const upcomingEvents = useMemo(
    () => calendarEvents.filter((e) => e.status !== 'past'),
    [calendarEvents]
  );
  const nextEvent = useMemo(
    () => calendarEvents.find((e) => e.status === 'next') || calendarEvents[calendarEvents.length - 1],
    [calendarEvents]
  );

  useEffect(() => {
    if (upcomingEvents.length <= 1) return;
    const timer = setInterval(() => {
      setHeaderEventIdx((prev) => (prev + 1) % upcomingEvents.length);
    }, 10000);
    return () => clearInterval(timer);
  }, [upcomingEvents.length]);

  const activeHeaderEvent =
    upcomingEvents.length > 0
      ? upcomingEvents[headerEventIdx % upcomingEvents.length]
      : nextEvent;
  const isImmediateNextHeaderEvent =
    activeHeaderEvent && nextEvent && activeHeaderEvent.id === nextEvent.id;

  const calendarCard = (
    <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#eab308]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Calendário LMU Q3/Q4 2026
          </h2>
        </div>
        <span className="text-[10px] font-medium text-slate-400">Sáb & Dom</span>
      </div>

      {nextEvent && (() => {
        const nextSignups = eventSignups[nextEvent.id] || [];
        const nextFlag =
          nextEvent.id === 'tba-dec'
            ? '🏁'
            : LMU_CIRCUITS.find((c) => c.id === detectCircuitIdFromEvent(nextEvent))?.flag || '🏁';
        return (
          <button
            type="button"
            onClick={() => openCalendarEventModal(nextEvent)}
            title="Clique para pré-cadastrar piloto nesta etapa"
            className="mb-3 w-full text-left rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 cursor-pointer transition-colors hover:bg-amber-500/20 active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#eab308]">
                <Sparkles className="h-3 w-3" />
                <span>Próximo Evento</span>
              </div>
              {nextSignups.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#22c55e]">
                  <Users className="h-2.5 w-2.5" />
                  ({String(nextSignups.length).padStart(2, '0')})
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-bold text-white">
              <span className="text-base leading-none">{nextFlag}</span>
              <span>
                {nextEvent.track}
                {nextSignups.length > 0 ? ` (${String(nextSignups.length).padStart(2, '0')})` : ''} — {nextEvent.dates}
              </span>
            </div>
            <div className="text-[11px] text-amber-200/80">
              {nextEvent.classes}
            </div>
          </button>
        );
      })()}

      <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
        {calendarEvents.map((ev) => {
          const signups = eventSignups[ev.id] || [];
          const evFlag =
            ev.id === 'tba-dec'
              ? '🏁'
              : LMU_CIRCUITS.find((c) => c.id === detectCircuitIdFromEvent(ev))?.flag || '🏁';
          return (
            <button
              type="button"
              key={ev.id}
              onClick={() => openCalendarEventModal(ev)}
              title="Clique para pré-cadastrar piloto nesta etapa"
              className={`w-full text-left flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                ev.status === 'next'
                  ? 'bg-amber-500/15 border border-amber-500/30 text-amber-200 font-semibold hover:bg-amber-500/25'
                  : ev.status === 'past'
                  ? 'text-slate-500 line-through hover:bg-slate-800/40'
                  : 'text-slate-300 bg-[#0f172a]/50 hover:bg-[#0f172a]'
              }`}
            >
              <span className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                <span className="shrink-0 text-sm leading-none">{evFlag}</span>
                <span className="truncate">
                  {ev.track}
                  {signups.length > 0 && (
                    <span className="ml-1 font-mono text-[11px] font-bold text-[#22c55e]">
                      ({String(signups.length).padStart(2, '0')})
                    </span>
                  )}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[11px]">{ev.dates}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col">
      {/* TOP BAR */}
      <header className="sticky top-0 z-40 border-b border-[#334155] bg-[#0f172a]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap xl:flex-nowrap items-center justify-between gap-2 xl:gap-2.5 px-4 py-2.5 sm:px-5">
          <div className="flex w-full lg:w-auto items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <img
                src="/ftr-logo.jpg"
                alt="Faster Team Racing"
                className="h-11 w-11 shrink-0 rounded-lg object-cover border border-amber-500/40 bg-black"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-extrabold tracking-tight text-white sm:text-xl">
                    FTR <span className="text-[#eab308]">PITWALL</span>
                  </h1>
                  <span className="hidden rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#22c55e] sm:inline-block">
                    LMU Protótipo
                  </span>
                </div>
                <p className="text-xs text-slate-400">Engenharia de Corrida</p>
              </div>
            </div>

            {/* Tiny Car Brand Logo + Class + Short Track on Top-Right (Mobile & < xl) */}
            <div className="xl:hidden flex flex-col items-center text-center rounded-md border border-[#334155] bg-[#1e293b]/90 px-2 py-1">
              <div className="flex items-center justify-center gap-1.5">
                <ManufacturerLogo brand={selectedCar.brand} size={18} />
                <span
                  className={`rounded border px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider leading-none ${selectedClassMeta.badgeClass}`}
                >
                  {selectedClassMeta.label}
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-center gap-1 text-[8.5px] font-semibold text-slate-300 leading-none">
                <span className="text-[10px] leading-none">{selectedCircuit.flag}</span>
                <span>{selectedCircuit.shortName}</span>
              </div>
            </div>
          </div>

          {activeHeaderEvent && (
            <div className="w-full sm:w-auto flex justify-center">
              <button
                type="button"
                onClick={handleGoToCalendar}
                title="Ir para o Calendário LMU"
                className="relative inline-flex overflow-hidden rounded-lg p-[1.5px] shadow-[0_0_15px_rgba(234,179,8,0.18)] cursor-pointer transition-transform active:scale-[0.98]"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-[-150%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg_250deg,#eab308_310deg,#fef08a_335deg,transparent_360deg)]"
                />
                <div className="relative flex items-center justify-center gap-2 rounded-[7px] bg-[#0f172a] bg-gradient-to-r from-[#1e293b]/90 via-[#0f172a] to-[#1e293b]/90 px-3 py-1.5 text-xs text-center">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#eab308]" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#eab308] mr-1.5">
                      {isImmediateNextHeaderEvent ? 'Próxima Corrida:' : 'Em Breve:'}
                    </span>
                    <span className="font-bold text-white">{activeHeaderEvent.track}</span>
                    <span className="ml-1.5 font-mono text-[11px] text-amber-200">
                      ({activeHeaderEvent.dates})
                    </span>
                  </div>
                </div>
              </button>
            </div>
          )}

          <div className="hidden xl:flex items-center justify-center gap-2.5 rounded-lg border border-[#334155] bg-[#1e293b]/90 px-2.5 py-1.5 shrink-0">
            <div className="flex flex-col items-center justify-center leading-none">
              <ManufacturerLogo brand={selectedCar.brand} size={24} />
              <span className="mt-1 text-sm leading-none" title={selectedCircuit.country}>
                {selectedCircuit.flag}
              </span>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-[11px] font-bold text-white whitespace-nowrap">{selectedCar.name}</span>
                <span
                  className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${selectedClassMeta.badgeClass}`}
                >
                  {selectedClassMeta.label}
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-center gap-1 text-[10px] text-slate-400">
                <MapPin className="h-2.5 w-2.5 shrink-0 text-[#eab308]" />
                <span className="truncate max-w-[180px]">{selectedCircuit.name}</span>
              </div>
            </div>
          </div>

          <div className="flex w-full sm:w-auto flex-wrap sm:flex-nowrap items-center justify-between sm:justify-start gap-1.5 shrink-0">
            {/* Desktop Connection Status Pill */}
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-semibold ${syncStatus === 'live'
                ? 'border-emerald-500/40 bg-emerald-500/15 text-[#22c55e]'
                : 'border-amber-500/40 bg-amber-500/10 text-[#eab308]'
                }`}
              title={
                syncStatus === 'live'
                  ? `Conectado à sala ${roomPin} (${livePeersCount} conectado${livePeersCount === 1 ? '' : 's'})`
                  : 'Salvamento local automático (offline fallback)'
              }
            >
              <span
                className={`h-2 w-2 rounded-full ${syncStatus === 'live' ? 'bg-[#22c55e] animate-pulse' : 'bg-[#eab308]'
                  }`}
              />
              <span>
                {syncStatus === 'live'
                  ? `Sincronizado ao Vivo (${String(livePeersCount).padStart(2, '0')})`
                  : 'Modo Local'}
              </span>
            </div>

            {/* Live Room (PIN) Trigger — Desktop separate, Mobile unified with Status */}
            <div className="relative">
              {/* Desktop animated trigger */}
              <div
                className={`hidden sm:inline-flex relative overflow-hidden rounded-lg p-[1.5px] transition-shadow ${
                  syncStatus === 'live'
                    ? 'shadow-[0_0_14px_rgba(34,197,94,0.3)]'
                    : 'shadow-[0_0_18px_rgba(234,179,8,0.4)]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-[-150%] animate-[spin_2.6s_linear_infinite] ${
                    syncStatus === 'live'
                      ? 'bg-[conic-gradient(from_0deg,transparent_0deg_240deg,#22c55e_305deg,#86efac_335deg,transparent_360deg)]'
                      : 'bg-[conic-gradient(from_0deg,transparent_0deg_230deg,#eab308_300deg,#fef08a_335deg,transparent_360deg)]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setPinDraft(roomPin);
                    setRoomModalOpen((prev) => !prev);
                  }}
                  className={`relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-[7px] px-2 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    syncStatus === 'live'
                      ? 'bg-[#0b1f17] text-emerald-300 hover:bg-[#0f291e]'
                      : 'bg-[#1a1608] text-amber-200 hover:bg-[#241e0a]'
                  }`}
                  title="Configurar Sala Ao Vivo (PIN)"
                >
                  <Radio
                    className={`h-3.5 w-3.5 ${
                      syncStatus === 'live'
                        ? 'text-[#22c55e] animate-pulse'
                        : 'text-[#eab308] animate-bounce'
                    }`}
                  />
                  <span className="hidden 2xl:inline">
                    {syncStatus === 'live' ? 'Sala:' : 'Conectar:'}
                  </span>
                  <span className="font-mono text-[11px] font-extrabold text-white">
                    {roomPin || 'PIN'}
                  </span>
                </button>
              </div>

              {/* Mobile animated unified trigger */}
              <div
                className={`inline-flex sm:hidden relative overflow-hidden rounded-lg p-[1.5px] transition-shadow ${
                  syncStatus === 'live'
                    ? 'shadow-[0_0_14px_rgba(34,197,94,0.3)]'
                    : 'shadow-[0_0_18px_rgba(234,179,8,0.42)]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-[-150%] animate-[spin_2.6s_linear_infinite] ${
                    syncStatus === 'live'
                      ? 'bg-[conic-gradient(from_0deg,transparent_0deg_240deg,#22c55e_305deg,#86efac_335deg,transparent_360deg)]'
                      : 'bg-[conic-gradient(from_0deg,transparent_0deg_230deg,#eab308_300deg,#fef08a_335deg,transparent_360deg)]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setPinDraft(roomPin);
                    setRoomModalOpen((prev) => !prev);
                  }}
                  className={`relative inline-flex items-center justify-center gap-1.5 rounded-[7px] px-2.5 py-1 text-center transition-colors cursor-pointer ${
                    syncStatus === 'live'
                      ? 'bg-[#0b1f17] text-[#22c55e]'
                      : 'bg-[#1a1608] text-amber-200'
                  }`}
                  title="Status e Sala Ao Vivo (PIN)"
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      syncStatus === 'live'
                        ? 'bg-[#22c55e] animate-pulse'
                        : 'bg-[#eab308] animate-ping'
                    }`}
                  />
                  <span className="flex flex-col items-center leading-tight">
                    <span className="whitespace-nowrap text-[9px] font-bold uppercase tracking-wider opacity-95">
                      {syncStatus === 'live'
                        ? `Ao Vivo (${String(livePeersCount).padStart(2, '0')})`
                        : 'Modo Local'}
                    </span>
                    <span className="font-mono text-[10px] font-extrabold text-white">
                      {roomPin || 'Conectar'}
                    </span>
                  </span>
                </button>
              </div>

              {roomModalOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:block sm:bg-transparent sm:p-0"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setRoomModalOpen(false);
                  }}
                >
                  <div className="w-full max-w-xs sm:w-72 rounded-xl border border-[#334155] bg-[#0f172a] p-4 shadow-2xl">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Sala Ao Vivo (PIN)
                    </span>
                    <button
                      type="button"
                      onClick={() => setRoomModalOpen(false)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <form onSubmit={handleConnectLiveRoom} className="space-y-2.5">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                        PIN da Equipe
                      </label>
                      <input
                        type="text"
                        value={pinDraft}
                        onChange={(e) => setPinDraft(e.target.value.toUpperCase())}
                        placeholder="Digite o PIN..."
                        className="w-full rounded-lg border border-[#334155] bg-[#1e293b] px-2.5 py-1.5 text-xs font-mono font-bold uppercase text-white focus:border-[#eab308] focus:outline-none"
                      />
                    </div>

                    {!isSupabaseConfigured && (
                      <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] leading-relaxed text-amber-200">
                        Variáveis <code className="font-mono">VITE_SUPABASE_URL</code> e{' '}
                        <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> não detectadas.
                        Operando em <strong>Modo Local</strong> com fallback automático.
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="flex-1 rounded-lg bg-[#eab308] px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
                      >
                        {liveRoomEnabled ? 'Atualizar Sala' : 'Conectar Sala'}
                      </button>
                      {liveRoomEnabled && (
                        <button
                          type="button"
                          onClick={() => {
                            setLiveRoomEnabled(false);
                            setSyncStatus('local');
                            setRoomModalOpen(false);
                            showToast('Desconectado da sala. Modo Local ativo.', 'warning');
                          }}
                          className="rounded-lg border border-[#334155] bg-[#1e293b] px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                        >
                          Sair
                        </button>
                      )}
                    </div>
                  </form>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleShareLink}
              title="Copiar link compartilhável da estratégia"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2 py-1.5 sm:px-2.5 text-xs font-bold text-[#22c55e] transition-colors hover:border-emerald-400 hover:bg-emerald-500/25 cursor-pointer"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Compartilhar</span>
            </button>

            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border px-2 py-1.5 sm:px-2.5 text-xs font-bold transition-all cursor-pointer ${copied
                ? 'border-emerald-500/60 bg-emerald-500/20 text-[#22c55e]'
                : 'border-amber-500/50 bg-[#eab308] text-slate-950 hover:bg-amber-400'
                }`}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Copiado!</span>
                  <span className="sm:hidden">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>WhatsApp</span>
                </>
              )}
            </button>

            {/* Mobile-only best tire reuse summary on its own row below */}
            <div
              onClick={() => toggleMobilePage(2)}
              title={mobilePage === 2 ? 'Voltar para a tela anterior' : 'Ver conjunto detalhado de pneus usados'}
              className="w-full sm:hidden flex items-center justify-between gap-2 rounded-lg border border-emerald-500/35 bg-[#1e293b] px-2.5 py-1.5 text-[10px] font-mono cursor-pointer transition-colors hover:border-emerald-400/60 active:scale-[0.99]"
            >
              <div className="flex items-center gap-1.5 shrink-0 text-[#22c55e] font-sans font-bold uppercase tracking-wider text-[9px]">
                <Disc className="h-3.5 w-3.5" />
                <span>Melhores Pneus Usados</span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-0.5">
                {TIRE_CORNERS.map(({ key }) => {
                  const best = tireRecommendations[key]?.best;
                  return (
                    <span key={`mob-rec-${key}`} className="tabular-nums">
                      <span className="text-slate-400">{key}:</span>{' '}
                      {best ? (
                        <span className={`font-bold ${getTireTextColor(best.pct)}`}>
                          {best.tireId} {best.pct}%
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Mobile-only 1-line race summary strip */}
            <div
              onClick={() => toggleMobilePage(0)}
              title={mobilePage === 0 ? 'Voltar para a tela anterior' : 'Ir para Parâmetros da Corrida'}
              className="w-full sm:hidden flex items-center justify-between gap-0.5 rounded-lg border border-[#334155] bg-[#1e293b]/90 px-1.5 py-1.5 text-[9.5px] font-mono tabular-nums cursor-pointer transition-colors hover:border-amber-500/50 active:scale-[0.99]"
            >
              <div className="flex flex-col items-center leading-tight">
                <span className="text-[7px] font-sans uppercase text-slate-400">Stints</span>
                <span className="font-bold text-white">{raceStintCount}</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex flex-col items-center leading-tight">
                <span className="text-[7px] font-sans uppercase text-slate-400">Voltas</span>
                <span className="font-bold text-[#22c55e]">{totalEstimatedLaps}</span>
              </div>
              <span className="text-slate-700">|</span>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  goToMobileParamField(mobileSessionStartRef);
                }}
                title="Ajustar horário da sessão"
                className="flex flex-col items-center leading-tight rounded px-1 py-0.5 hover:bg-amber-500/15 active:scale-95"
              >
                <span className="text-[7px] font-sans uppercase text-slate-400">Horário</span>
                <span className="font-bold text-white">
                  {raceStints[0] ? formatMinutesToHHMM(raceStints[0].startMin) : '--:--'}→
                  {raceStints[raceStints.length - 1]
                    ? formatMinutesToHHMM(raceStints[raceStints.length - 1].endMin)
                    : '--:--'}
                </span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex flex-col items-center leading-tight">
                <span className="text-[7px] font-sans uppercase text-slate-400">Pilotos</span>
                <span className="font-bold text-[#eab308]">
                  {new Set(raceStints.map((s) => s.driver).filter((d) => d && d !== 'ND')).size}
                </span>
              </div>
              <span className="text-slate-700">|</span>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  goToMobileParamField(mobileAvailableTiresRef);
                }}
                title="Ajustar pneus disponíveis"
                className="flex flex-col items-center leading-tight rounded px-1 py-0.5 hover:bg-emerald-500/15 active:scale-95"
              >
                <span className="text-[7px] font-sans uppercase text-slate-400">Pneus</span>
                <span
                  className={`font-bold ${
                    remainingTiresCount < 0 ? 'text-red-400' : 'text-[#22c55e]'
                  }`}
                >
                  {usedTiresCount}/{availableTiresNum}
                </span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex flex-col items-center leading-tight">
                <span className="text-[7px] font-sans uppercase text-slate-400">Ratio</span>
                <span className="font-bold text-amber-300">
                  {telemetry.fuelRatio.toFixed(2)}
                </span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex flex-col items-center leading-tight">
                <span className="text-[7px] font-sans uppercase text-slate-400">Auton</span>
                <span className="font-bold text-[#22c55e]">{telemetry.maxStintLaps}v</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      {/* MOBILE SWIPEABLE 2-PAGE VIEW (< lg) */}
      <div
        ref={mobilePagerRef}
        onScroll={handleMobilePagerScroll}
        className="lg:hidden flex flex-1 w-full overflow-x-auto snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* PAGE 1 (LEFT - SWIPE RIGHT FROM CENTER): PARAMS */}
        <div className="w-full shrink-0 snap-start px-4 py-4 space-y-4">
          <div className="rounded-xl border border-[#334155] bg-[#1e293b] overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-[#334155] bg-slate-800/80 px-4 py-3">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-[#eab308]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Parâmetros da Corrida
                </h2>
              </div>
              <button
                type="button"
                onClick={handleReset}
                title="Resetar Estratégia"
                className="inline-flex items-center gap-1 rounded-md border border-[#334155] bg-[#0f172a] px-2 py-1 text-[11px] font-semibold text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
              >
                <RotateCcw className="h-3 w-3 text-slate-400" />
                <span>Resetar</span>
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Car & Class Selector */}
              <div className="rounded-lg border border-[#334155] bg-[#0f172a]/70 p-3 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <ManufacturerLogo brand={selectedCar.brand} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${selectedClassMeta.badgeClass}`}
                      >
                        {selectedClassMeta.label}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs font-bold leading-snug text-white">
                      {selectedCar.name}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                      Categoria
                    </label>
                    <select
                      value={params.carClass || selectedCar.classId}
                      onChange={(e) => {
                        const nextClass = e.target.value;
                        const firstCar = LMU_CARS.find((c) => c.classId === nextClass);
                        setParams((prev) => ({
                          ...prev,
                          carClass: nextClass,
                          carId: firstCar ? firstCar.id : prev.carId,
                        }));
                      }}
                      className="w-full rounded-md border border-[#334155] bg-[#1e293b] px-2 py-1.5 text-xs font-semibold text-slate-100 focus:border-[#eab308] focus:outline-none"
                    >
                      {LMU_CAR_CLASSES.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                      Carro
                    </label>
                    <select
                      value={selectedCar.id}
                      onChange={(e) => handleParamChange('carId', e.target.value)}
                      className="w-full rounded-md border border-[#334155] bg-[#1e293b] px-2 py-1.5 text-xs font-medium text-slate-100 focus:border-[#eab308] focus:outline-none"
                    >
                      {carsInSelectedClass.map((car) => (
                        <option key={car.id} value={car.id}>
                          {car.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-400">
                    <MapPin className="h-3 w-3 text-[#eab308]" />
                    Circuito
                  </label>
                  <button
                    type="button"
                    onClick={() => setCircuitModalOpen(true)}
                    className="w-full flex items-center justify-between gap-3 rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-2 text-left cursor-pointer transition-colors hover:border-amber-500/60 hover:bg-[#1e293b]/90 active:scale-[0.99]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <span className="text-lg leading-none">{selectedCircuit.flag}</span>
                        <span>{selectedCircuit.shortName}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-400">{selectedCircuit.country}</div>
                    </div>
                    <CircuitTrackSvg
                      svgPath={selectedCircuit.svgPath}
                      className="h-12 w-24 shrink-0 text-[#eab308]"
                    />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Clock className="h-3 w-3 text-[#eab308]" />
                    Início da Sessão
                  </label>
                  <input
                    ref={mobileSessionStartRef}
                    type="time"
                    value={params.sessionStart}
                    onChange={(e) => handleParamChange('sessionStart', e.target.value)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Timer className="h-3 w-3 text-[#eab308]" />
                    Duração Corrida (00:00)
                  </label>
                  <input
                    type="text"
                    placeholder="06:00"
                    value={params.raceDurationStr}
                    onChange={(e) => handleParamChange('raceDurationStr', e.target.value)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Gauge className="h-3 w-3 text-[#22c55e]" />
                    Tempo de Volta
                  </label>
                  <input
                    type="text"
                    placeholder="01:45.320"
                    value={params.lapTimeStr}
                    onChange={(e) => handleParamChange('lapTimeStr', e.target.value)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Fuel className="h-3 w-3 text-[#eab308]" />
                    Tanque (Litros)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={params.tankCapacityL}
                    onChange={(e) =>
                      handleParamChange('tankCapacityL', Math.max(1, Number(e.target.value) || 0))
                    }
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Fuel className="h-3 w-3 text-slate-400" />
                    Consumo (L/volta)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={params.fuelPerLapL}
                    onChange={(e) =>
                      handleParamChange('fuelPerLapL', Math.max(0.1, Number(e.target.value) || 0.1))
                    }
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Zap className="h-3 w-3 text-[#22c55e]" />
                    Energia Virt. (%/v)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={params.virtualEnergyPerLapPct}
                    onChange={(e) =>
                      handleParamChange(
                        'virtualEnergyPerLapPct',
                        Math.max(0.1, Number(e.target.value) || 0.1)
                      )
                    }
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    Free Practice (min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={params.fpDurationMin}
                    onChange={(e) =>
                      handleParamChange('fpDurationMin', Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    Qualy (min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={params.qualyDurationMin}
                    onChange={(e) =>
                      handleParamChange('qualyDurationMin', Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-400">
                    <span className="flex items-center gap-1">
                      <Disc className="h-3 w-3 text-[#22c55e]" />
                      Pneus Disponíveis
                    </span>
                    <span
                      className={`font-mono text-[10px] ${
                        remainingTiresCount < 0 ? 'text-red-400 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      Utilizados: {usedTiresCount} • Restantes: {remainingTiresCount}
                    </span>
                  </label>
                  <div className="flex items-center gap-2.5">
                    <input
                      ref={mobileAvailableTiresRef}
                      type="number"
                      min="0"
                      step="1"
                      value={params.availableTires ?? 24}
                      onChange={(e) =>
                        handleParamChange('availableTires', Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-16 shrink-0 rounded-lg border border-[#334155] bg-[#0f172a] px-2 py-1.5 text-center text-sm font-mono font-bold tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                    />
                    <div className="flex flex-1 flex-wrap items-center gap-1">
                      {Array.from({ length: Math.min(availableTiresNum, 48) }).map((_, idx) => (
                        <MiniPirelliTire key={`m-tire-${idx}`} size={15} />
                      ))}
                      {availableTiresNum > 48 && (
                        <span className="font-mono text-[10px] font-bold text-amber-300">
                          +{availableTiresNum - 48}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#334155] pt-3">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  <Wrench className="h-3.5 w-3.5 text-[#eab308]" />
                  <span>Tempos Médios de Pitstop (seg)</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">Combustível + 4 Pneus + Piloto</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={params.pitTime4TiresSec}
                        onChange={(e) =>
                          handleParamChange('pitTime4TiresSec', Math.max(0, Number(e.target.value) || 0))
                        }
                        className="w-16 rounded-md border border-[#334155] bg-[#0f172a] px-2 py-1 text-right text-xs font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">s</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">Combustível + 2 Pneus + Piloto</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={params.pitTime2TiresSec}
                        onChange={(e) =>
                          handleParamChange('pitTime2TiresSec', Math.max(0, Number(e.target.value) || 0))
                        }
                        className="w-16 rounded-md border border-[#334155] bg-[#0f172a] px-2 py-1 text-right text-xs font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">s</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">Apenas Combustível + Piloto</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={params.pitTimeFuelOnlySec}
                        onChange={(e) =>
                          handleParamChange('pitTimeFuelOnlySec', Math.max(0, Number(e.target.value) || 0))
                        }
                        className="w-16 rounded-md border border-[#334155] bg-[#0f172a] px-2 py-1 text-right text-xs font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">s</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">Somente Troca de Piloto</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={params.pitTimeDriverOnlySec}
                        onChange={(e) =>
                          handleParamChange('pitTimeDriverOnlySec', Math.max(0, Number(e.target.value) || 0))
                        }
                        className="w-16 rounded-md border border-[#334155] bg-[#0f172a] px-2 py-1 text-right text-xs font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">s</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PAGE 2 (CENTER - DEFAULT): STINTS */}
        <div className="w-full shrink-0 snap-start px-4 py-4">
          <div className="rounded-xl border border-[#334155] bg-[#1e293b]">
            <div className="flex flex-col gap-2 rounded-t-xl border-b border-[#334155] bg-slate-800/80 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Clock className="h-4 w-4 shrink-0 text-[#eab308]" />
                  <h2 className="truncate text-xs font-bold uppercase tracking-wider text-slate-200">
                    Cronograma & Stints
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={toggleAllStintsCollapse}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#334155] bg-[#0f172a] px-2 py-1 text-[10px] font-semibold text-slate-200 transition-colors hover:border-[#eab308]/60 hover:text-[#eab308] cursor-pointer"
                >
                  {areAllStintsCollapsed ? (
                    <>
                      <ChevronDown className="h-3 w-3" />
                      <span>Expandir Tudo</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-3 w-3" />
                      <span>Empacotar Tudo</span>
                    </>
                  )}
                </button>
              </div>
              {raceDriverStats.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {raceDriverStats.map((d) => {
                    const hrs = Math.floor(d.durationMin / 60);
                    const mins = Math.round(d.durationMin % 60);
                    const timeStr = hrs > 0 ? `${hrs}h${String(mins).padStart(2, '0')}` : `${mins}m`;
                    const firstName = d.driver.split(' ')[0];
                    return (
                      <div
                        key={`m-drv-${d.driver}`}
                        className="flex items-center gap-1.5 rounded-md border border-[#334155] bg-[#0f172a]/90 px-1.5 py-1 min-w-0"
                      >
                        <DriverAvatar90s driver={d.driver} size={20} />
                        <div className="flex flex-col leading-none min-w-0">
                          <span className="truncate text-[9px] font-bold text-slate-100">{firstName}</span>
                          <span className="truncate font-mono text-[8.5px] text-amber-300 tabular-nums">
                            {d.laps}v • {timeStr}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2.5 p-2.5 bg-[#0f172a]/70">
              {enrichedSchedule.map((row) => {
                const isCollapsed = Boolean(collapsedStints[row.id]);
                const nextStintLabel = `Stint ${String((row.stintNum || 0) + 1).padStart(2, '0')}`;
                const cardColorClass =
                  row.type === 'fp'
                    ? 'border-sky-500/35 border-l-sky-400 bg-gradient-to-br from-sky-950/60 via-[#1e293b] to-[#172033]'
                    : row.type === 'qualy'
                    ? 'border-amber-500/40 border-l-[#eab308] bg-gradient-to-br from-amber-950/45 via-[#1e293b] to-[#172033]'
                    : 'border-emerald-500/35 border-l-[#22c55e] bg-gradient-to-br from-emerald-950/45 via-[#1e293b] to-[#172033]';
                const labelBadgeClass =
                  row.type === 'fp'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : row.type === 'qualy'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                return (
                  <React.Fragment key={`m-page-${row.id}`}>
                  <div className={`rounded-xl border border-l-4 p-3.5 space-y-3 shadow-md transition-colors ${cardColorClass}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleStintCollapse(row.id)}
                          title={isCollapsed ? 'Expandir stint' : 'Minimizar stint'}
                          className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#334155] bg-[#0f172a] text-slate-400 hover:text-[#eab308]"
                        >
                          {isCollapsed ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronUp className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <span
                          className={`inline-flex h-2.5 w-2.5 rounded-full ${
                            row.type === 'fp'
                              ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]'
                              : row.type === 'qualy'
                              ? 'bg-[#eab308] shadow-[0_0_8px_rgba(234,179,8,0.7)]'
                              : 'bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.7)]'
                          }`}
                        />
                        <div>
                          <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-extrabold tracking-wide ${labelBadgeClass}`}>{row.label}</span>
                          {isCollapsed && (
                            <div className="text-[11px] font-semibold text-amber-300">
                              {row.driver}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <div className="text-xs font-bold text-slate-100">
                          {formatMinutesToHHMM(row.startMin)} - {formatMinutesToHHMM(row.endMin)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {row.durationMin.toFixed(1)} min • {row.laps} voltas
                        </div>
                      </div>
                    </div>

                    {!isCollapsed && (
                    <>
                    <div className="flex items-center gap-3">
                      <DriverAvatar90s driver={row.driver} size={52} />
                      <div className="flex-1 min-w-0">
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                          Piloto
                        </label>
                        <select
                          value={row.driver}
                          onChange={(e) => {
                            if (row.type === 'race') {
                              updateRaceStint(row.stintNum, 'driver', e.target.value);
                            } else {
                              updatePreSession(row.type, 'driver', e.target.value);
                            }
                          }}
                          className="w-full rounded-md border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-xs text-slate-100 focus:border-[#eab308] focus:outline-none"
                        >
                          {DRIVERS.map((d) => {
                            const allowed = canAssignDriver(row.id, d);
                            return (
                              <option key={d} value={d} disabled={!allowed}>
                                {d}{!allowed ? ' (limite 6)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    {row.type === 'fp' ? (
                      <div className="rounded-md border border-[#334155] bg-[#0f172a]/60 px-3 py-2 text-xs text-slate-400">
                        Free Practice sem desgaste de pneus
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase text-slate-400">
                            <span>Pneus Início (Toque para alternar)</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (row.type === 'race') {
                                  updateRaceStint(row.stintNum, 'tiresStart', DEFAULT_FULL_TIRES);
                                } else {
                                  updatePreSession(row.type, 'tiresStart', DEFAULT_FULL_TIRES);
                                }
                              }}
                              className="inline-flex items-center rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20"
                            >
                              4 Pneus Novos
                            </button>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {TIRE_CORNERS.map(({ key }) => {
                              const tireMeta = row.startTireMeta?.[key];
                              const setStartVal = (val) => {
                                if (row.type === 'race') {
                                  updateRaceStintTire(row.stintNum, 'tiresStart', key, val);
                                } else {
                                  updatePreSessionTire(row.type, 'tiresStart', key, val);
                                }
                              };
                              return (
                                <StartTireToggleButton
                                  key={`m-p1-start-${key}`}
                                  corner={key}
                                  tireMeta={tireMeta}
                                  onToggle={() => {
                                    if (tireMeta?.mode === 'new') {
                                      setStartVal(tireMeta?.canKeep ? 'keep' : 'ND');
                                    } else if (tireMeta?.mode === 'keep') {
                                      setStartVal('ND');
                                    } else {
                                      setStartVal(100);
                                    }
                                  }}
                                />
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase text-slate-400">
                            <span>Pneus Fim — Borracha Restante</span>
                            {row.tiresEndEnabled && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (row.type === 'race') {
                                    updateRaceStint(row.stintNum, 'tiresEndEnabled', false);
                                  } else {
                                    updatePreSession(row.type, 'tiresEndEnabled', false);
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded border border-slate-600/70 bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300 transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300"
                              >
                                × Desregistrar
                              </button>
                            )}
                          </div>
                          {!row.tiresEndEnabled ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (row.type === 'race') {
                                  updateRaceStint(row.stintNum, 'tiresEndEnabled', true);
                                } else {
                                  updatePreSession(row.type, 'tiresEndEnabled', true);
                                }
                              }}
                              className="w-full rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 transition-colors hover:border-amber-400 hover:bg-amber-500/20"
                            >
                              + Registrar Desgaste de Fim de Stint
                            </button>
                          ) : (
                            <div className="grid grid-cols-4 gap-2">
                              {TIRE_CORNERS.map(({ key }) => (
                                <TireBadgeEditor
                                  key={`m-p1-end-${key}`}
                                  corner={key}
                                  tireId={row.endTireMeta?.[key]?.tireId}
                                  value={row.tiresEnd[key]}
                                  onChange={(val) => {
                                    if (row.type === 'race') {
                                      updateRaceStintTire(row.stintNum, 'tiresEnd', key, val);
                                    } else {
                                      updatePreSessionTire(row.type, 'tiresEnd', key, val);
                                    }
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    </>
                    )}
                  </div>

                  {!isCollapsed && row.type === 'race' && !row.isLastStint && (
                    <div className="bg-amber-500/10 px-4 py-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Wrench className="h-3.5 w-3.5 text-[#eab308]" />
                          <span className="font-bold uppercase tracking-wider text-[#eab308]">
                            Pitstop ({row.label} → {nextStintLabel})
                          </span>
                        </div>
                        <span className="font-mono text-slate-300">
                          {formatMinutesToHHMM(row.endMin)}
                        </span>
                      </div>
                      <select
                        value={row.pitScenario}
                        onChange={(e) =>
                          updateRaceStint(row.stintNum, 'pitScenario', e.target.value)
                        }
                        className="w-full rounded-md border border-amber-500/35 bg-[#0f172a] px-2.5 py-2 text-xs text-slate-100 focus:border-[#eab308] focus:outline-none"
                      >
                        {PIT_SCENARIOS.map((sc) => (
                          <option key={sc.id} value={sc.id}>
                            {sc.label} ({getPitTimeSeconds(sc.id, params)}s)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* PAGE 3 (SWIPE LEFT FROM CENTER): TIRE MANAGER, FUEL RATIO & CALENDAR */}
        <div className="w-full shrink-0 snap-start px-4 py-4 space-y-4">
          {/* TIRE MANAGER */}
          <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Disc className="h-4 w-4 text-[#22c55e]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Gerenciador de Pneus — Melhores para Reaproveitar
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TIRE_CORNERS.map(({ key, label }) => {
                const rec = tireRecommendations[key];
                const best = rec?.best;
                const second = rec?.secondBest;
                return (
                  <button
                    type="button"
                    key={`m-p2-tm-${key}`}
                    onClick={() => setSelectedTireCornerModal(key)}
                    title={`Ver todos os pneus usados em ${key} (${label})`}
                    className="w-full text-left rounded-lg border border-[#334155] bg-[#0f172a]/90 p-3.5 flex flex-col justify-between cursor-pointer transition-colors hover:border-emerald-500/50 hover:bg-[#0f172a] active:scale-[0.99]"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-200">
                          {key} <span className="font-normal text-slate-400">({label})</span>
                        </span>
                        <span className="rounded bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#22c55e]">
                          SUGERIDO
                        </span>
                      </div>
                      {best ? (
                        <>
                          <div className="mt-2.5 flex items-baseline justify-between">
                            <span
                              className={`text-2xl font-extrabold font-mono tabular-nums ${getTireTextColor(
                                best.pct
                              )}`}
                            >
                              {best.pct}%
                            </span>
                            <span className="text-xs font-medium text-slate-300">
                              <span className="font-mono font-bold text-amber-300 mr-1">
                                {best.tireId}
                              </span>
                              ({best.sourceLabel})
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={`h-full transition-all ${getTireBarColor(best.pct)}`}
                              style={{ width: `${best.pct}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Sem dados</span>
                        </div>
                      )}
                    </div>
                    {second && (
                      <div className="mt-3 border-t border-[#334155]/70 pt-2 flex items-center justify-between text-[11px] text-slate-400">
                        <span>2ª melhor opção:</span>
                        <span className="font-mono tabular-nums text-slate-300">
                          {second.pct}% ({second.tireId} • {second.sourceLabel})
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* FUEL RATIO & AUTONOMY */}
          <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#eab308]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#eab308]">
                  Fuel Ratio & Autonomia
                </h2>
              </div>
              <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30">
                Limite: {telemetry.limitingFactor}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[#334155] bg-[#0f172a]/80 p-3">
                <div className="text-[11px] text-slate-400">Fuel Ratio</div>
                <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-white">
                  {telemetry.fuelRatio.toFixed(2)}
                  <span className="ml-1 text-xs font-normal text-amber-400">L/%</span>
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500">
                  {params.fuelPerLapL}L ÷ {params.virtualEnergyPerLapPct}%
                </div>
              </div>
              <div className="rounded-lg border border-[#334155] bg-[#0f172a]/80 p-3">
                <div className="text-[11px] text-slate-400">Autonomia Máx / Stint</div>
                <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-[#22c55e]">
                  {telemetry.maxStintLaps}
                  <span className="ml-1 text-xs font-normal text-emerald-300">voltas</span>
                </div>
                <div className="mt-0.5 text-[10px] font-mono text-slate-400 tabular-nums">
                  ~{telemetry.maxStintMin.toFixed(1)} min / stint
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-[#334155]/70 pt-2.5">
              <span>Tanque: {telemetry.maxLapsByFuel}v</span>
              <span>•</span>
              <span>Energia 100%: {telemetry.maxLapsByEnergy}v</span>
              <span>•</span>
              <span className="text-slate-200 font-semibold">{raceStintCount} stints</span>
            </div>
          </div>

          <div ref={mobileCalendarRef}>{calendarCard}</div>
        </div>
      </div>

      {/* DESKTOP 2-COLUMN WORKSPACE (lg+) */}
      <main className="hidden lg:flex mx-auto w-full max-w-[1600px] flex-1 flex-row gap-5 p-6">
        {/* LEFT SIDEBAR: PARAMETERS & CALENDAR */}
        <aside className="w-full shrink-0 space-y-4 lg:w-[320px] xl:w-[340px]">
          {/* Mobile Collapse Toggle for Parameters */}
          <div className="rounded-xl border border-[#334155] bg-[#1e293b] overflow-hidden">
            <button
              type="button"
              onClick={() => setMobileParamsOpen((prev) => !prev)}
              className="flex w-full items-center justify-between border-b border-[#334155] bg-slate-800/80 px-4 py-3 text-left lg:cursor-default"
            >
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-[#eab308]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Parâmetros da Corrida
                </h2>
              </div>
              <span className="lg:hidden text-slate-400">
                {mobileParamsOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </span>
            </button>

            <div className={`${mobileParamsOpen ? 'block' : 'hidden'} lg:block p-4 space-y-4`}>
              {/* Car & Class Selector */}
              <div className="rounded-lg border border-[#334155] bg-[#0f172a]/70 p-3 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <ManufacturerLogo brand={selectedCar.brand} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${selectedClassMeta.badgeClass}`}
                      >
                        {selectedClassMeta.label}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs font-bold leading-snug text-white">
                      {selectedCar.name}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                      Categoria
                    </label>
                    <select
                      value={params.carClass || selectedCar.classId}
                      onChange={(e) => {
                        const nextClass = e.target.value;
                        const firstCar = LMU_CARS.find((c) => c.classId === nextClass);
                        setParams((prev) => ({
                          ...prev,
                          carClass: nextClass,
                          carId: firstCar ? firstCar.id : prev.carId,
                        }));
                      }}
                      className="w-full rounded-md border border-[#334155] bg-[#1e293b] px-2 py-1.5 text-xs font-semibold text-slate-100 focus:border-[#eab308] focus:outline-none cursor-pointer"
                    >
                      {LMU_CAR_CLASSES.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                      Carro
                    </label>
                    <select
                      value={selectedCar.id}
                      onChange={(e) => handleParamChange('carId', e.target.value)}
                      className="w-full rounded-md border border-[#334155] bg-[#1e293b] px-2 py-1.5 text-xs font-medium text-slate-100 focus:border-[#eab308] focus:outline-none cursor-pointer"
                    >
                      {carsInSelectedClass.map((car) => (
                        <option key={car.id} value={car.id}>
                          {car.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-400">
                    <MapPin className="h-3 w-3 text-[#eab308]" />
                    Circuito
                  </label>
                  <button
                    type="button"
                    onClick={() => setCircuitModalOpen(true)}
                    className="w-full flex items-center justify-between gap-3 rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-2 text-left cursor-pointer transition-colors hover:border-amber-500/60 hover:bg-[#1e293b]/90 active:scale-[0.99]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <span className="text-lg leading-none">{selectedCircuit.flag}</span>
                        <span>{selectedCircuit.shortName}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-400">{selectedCircuit.country}</div>
                    </div>
                    <CircuitTrackSvg
                      svgPath={selectedCircuit.svgPath}
                      className="h-12 w-24 shrink-0 text-[#eab308]"
                    />
                  </button>
                </div>
              </div>

              {/* Grid of Main Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Clock className="h-3 w-3 text-[#eab308]" />
                    Início da Sessão
                  </label>
                  <input
                    type="time"
                    value={params.sessionStart}
                    onChange={(e) => handleParamChange('sessionStart', e.target.value)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Timer className="h-3 w-3 text-[#eab308]" />
                    Duração Corrida (00:00)
                  </label>
                  <input
                    type="text"
                    placeholder="06:00"
                    value={params.raceDurationStr}
                    onChange={(e) => handleParamChange('raceDurationStr', e.target.value)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Gauge className="h-3 w-3 text-[#22c55e]" />
                    Tempo de Volta
                  </label>
                  <input
                    type="text"
                    placeholder="01:45.320"
                    value={params.lapTimeStr}
                    onChange={(e) => handleParamChange('lapTimeStr', e.target.value)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Fuel className="h-3 w-3 text-[#eab308]" />
                    Tanque (Litros)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={params.tankCapacityL}
                    onChange={(e) =>
                      handleParamChange('tankCapacityL', Math.max(1, Number(e.target.value) || 0))
                    }
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Fuel className="h-3 w-3 text-slate-400" />
                    Consumo (L/volta)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={params.fuelPerLapL}
                    onChange={(e) =>
                      handleParamChange('fuelPerLapL', Math.max(0.1, Number(e.target.value) || 0.1))
                    }
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Zap className="h-3 w-3 text-[#22c55e]" />
                    Energia Virt. (%/v)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={params.virtualEnergyPerLapPct}
                    onChange={(e) =>
                      handleParamChange(
                        'virtualEnergyPerLapPct',
                        Math.max(0.1, Number(e.target.value) || 0.1)
                      )
                    }
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    Free Practice (min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={params.fpDurationMin}
                    onChange={(e) =>
                      handleParamChange('fpDurationMin', Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    Qualy (min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={params.qualyDurationMin}
                    onChange={(e) =>
                      handleParamChange('qualyDurationMin', Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-400">
                    <span className="flex items-center gap-1">
                      <Disc className="h-3 w-3 text-[#22c55e]" />
                      Pneus Disponíveis
                    </span>
                    <span
                      className={`font-mono text-[10px] ${remainingTiresCount < 0 ? 'text-red-400 font-semibold' : 'text-slate-400'
                        }`}
                    >
                      Utilizados: {usedTiresCount} • Restantes: {remainingTiresCount}
                    </span>
                  </label>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={params.availableTires ?? 24}
                      onChange={(e) =>
                        handleParamChange('availableTires', Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-16 shrink-0 rounded-lg border border-[#334155] bg-[#0f172a] px-2 py-1.5 text-center text-sm font-mono font-bold tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                    />
                    <div className="flex flex-1 flex-wrap items-center gap-1">
                      {Array.from({ length: Math.min(availableTiresNum, 48) }).map((_, idx) => (
                        <MiniPirelliTire key={`d-tire-${idx}`} size={15} />
                      ))}
                      {availableTiresNum > 48 && (
                        <span className="font-mono text-[10px] font-bold text-amber-300">
                          +{availableTiresNum - 48}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pitstop Times */}
              <div className="border-t border-[#334155] pt-3">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  <Wrench className="h-3.5 w-3.5 text-[#eab308]" />
                  <span>Tempos Médios de Pitstop (seg)</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">Combustível + 4 Pneus + Piloto</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={params.pitTime4TiresSec}
                        onChange={(e) =>
                          handleParamChange(
                            'pitTime4TiresSec',
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-16 rounded-md border border-[#334155] bg-[#0f172a] px-2 py-1 text-right text-xs font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">s</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">Combustível + 2 Pneus + Piloto</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={params.pitTime2TiresSec}
                        onChange={(e) =>
                          handleParamChange(
                            'pitTime2TiresSec',
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-16 rounded-md border border-[#334155] bg-[#0f172a] px-2 py-1 text-right text-xs font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">s</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">Apenas Combustível + Piloto</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={params.pitTimeFuelOnlySec}
                        onChange={(e) =>
                          handleParamChange(
                            'pitTimeFuelOnlySec',
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-16 rounded-md border border-[#334155] bg-[#0f172a] px-2 py-1 text-right text-xs font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">s</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">Somente Troca de Piloto</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={params.pitTimeDriverOnlySec}
                        onChange={(e) =>
                          handleParamChange(
                            'pitTimeDriverOnlySec',
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-16 rounded-md border border-[#334155] bg-[#0f172a] px-2 py-1 text-right text-xs font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">s</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#334155] pt-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                  <span>Resetar Estratégia</span>
                </button>
              </div>
            </div>
          </div>

          {/* HIGHLIGHT CARD: FUEL RATIO & AUTONOMY */}
          <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-4 shadow-lg">
            <button
              type="button"
              onClick={() => setMobileFuelOpen((prev) => !prev)}
              className="flex w-full items-center justify-between text-left lg:cursor-default"
            >
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#eab308]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#eab308]">
                  Fuel Ratio & Autonomia
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30">
                  Limite: {telemetry.limitingFactor}
                </span>
                <span className="lg:hidden text-slate-400">
                  {mobileFuelOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </span>
              </div>
            </button>

            {!mobileFuelOpen && (
              <div className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums lg:hidden">
                <span className="font-bold text-white">
                  {telemetry.fuelRatio.toFixed(2)} <span className="text-amber-400 font-normal">L/%</span>
                </span>
                <span className="font-bold text-[#22c55e]">
                  {telemetry.maxStintLaps}v (~{telemetry.maxStintMin.toFixed(1)}m)
                </span>
                <span className="text-slate-300">{raceStintCount} stints</span>
              </div>
            )}

            <div className={`${mobileFuelOpen ? 'block' : 'hidden'} lg:block mt-3`}>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[#334155] bg-[#0f172a]/80 p-3">
                  <div className="text-[11px] text-slate-400">Fuel Ratio</div>
                  <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-white">
                    {telemetry.fuelRatio.toFixed(2)}
                    <span className="ml-1 text-xs font-normal text-amber-400">L/%</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-500">
                    {params.fuelPerLapL}L ÷ {params.virtualEnergyPerLapPct}%
                  </div>
                </div>

                <div className="rounded-lg border border-[#334155] bg-[#0f172a]/80 p-3">
                  <div className="text-[11px] text-slate-400">Autonomia Máx / Stint</div>
                  <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-[#22c55e]">
                    {telemetry.maxStintLaps}
                    <span className="ml-1 text-xs font-normal text-emerald-300">voltas</span>
                  </div>
                  <div className="mt-0.5 text-[10px] font-mono text-slate-400 tabular-nums">
                    ~{telemetry.maxStintMin.toFixed(1)} min / stint
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-[#334155]/70 pt-2.5">
                <span>Tanque: {telemetry.maxLapsByFuel}v</span>
                <span>•</span>
                <span>Energia 100%: {telemetry.maxLapsByEnergy}v</span>
                <span>•</span>
                <span className="text-slate-200 font-semibold">{raceStintCount} stints</span>
              </div>
            </div>
          </div>

          {/* BOTTOM CARD: LMU CALENDAR Q3/Q4 2026 (Desktop Sidebar) */}
          <div ref={desktopCalendarRef} className="hidden lg:block">{calendarCard}</div>
        </aside>

        {/* RIGHT MAIN AREA: STINTS TABLE & TIRE MANAGER */}
        <section className="flex-1 min-w-0 space-y-5">
          {/* SUMMARY BAR (Desktop / Tablet) */}
          <div className="hidden sm:grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] px-4 py-3">
              <div className="text-[11px] text-slate-400">Stints de Corrida</div>
              <div className="mt-0.5 text-xl font-bold font-mono tabular-nums text-white">
                {raceStintCount}
              </div>
            </div>
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] px-4 py-3">
              <div className="text-[11px] text-slate-400">Voltas Estimadas</div>
              <div className="mt-0.5 text-xl font-bold font-mono tabular-nums text-[#22c55e]">
                {totalEstimatedLaps}
              </div>
            </div>
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] px-4 py-3">
              <div className="text-[11px] text-slate-400">Início → Término</div>
              <div className="mt-0.5 text-base font-bold font-mono tabular-nums text-white sm:text-lg">
                {raceStints[0] ? formatMinutesToHHMM(raceStints[0].startMin) : '--:--'} →{' '}
                {raceStints[raceStints.length - 1]
                  ? formatMinutesToHHMM(raceStints[raceStints.length - 1].endMin)
                  : '--:--'}
              </div>
            </div>
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] px-4 py-3">
              <div className="text-[11px] text-slate-400">Pilotos Ativos</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xl font-bold font-mono tabular-nums text-[#eab308]">
                <Users className="h-4 w-4" />
                <span>{new Set(raceStints.map((s) => s.driver).filter((d) => d && d !== 'ND')).size}</span>
              </div>
            </div>
            <div
              className={`col-span-2 sm:col-span-1 rounded-xl border px-4 py-3 ${remainingTiresCount < 0
                ? 'border-red-500/50 bg-red-500/10'
                : 'border-[#334155] bg-[#1e293b]'
                }`}
            >
              <div className="text-[11px] text-slate-400">Pneus Utilizados</div>
              <div
                className={`mt-0.5 flex items-baseline gap-1.5 text-xl font-bold font-mono tabular-nums ${remainingTiresCount < 0 ? 'text-red-400' : 'text-[#22c55e]'
                  }`}
              >
                <span>{usedTiresCount}</span>
                <span className="text-xs font-normal text-slate-400">
                  / {availableTiresNum} disp.
                </span>
              </div>
            </div>
          </div>

          {/* STINTS SCHEDULE PANEL */}
          <div className="rounded-xl border border-[#334155] bg-[#1e293b]">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl border-b border-[#334155] bg-slate-800/80 px-4 py-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#eab308]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Cronograma de Sessões & Stints
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-[11px] text-slate-400">
                  Clique nos badges de pneus (<span className="font-mono text-slate-200">FL/FR/RL/RR</span>) para editar
                </span>
                <button
                  type="button"
                  onClick={toggleAllStintsCollapse}
                  className="inline-flex items-center gap-1 rounded-md border border-[#334155] bg-[#0f172a] px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition-colors hover:border-[#eab308]/60 hover:text-[#eab308] cursor-pointer"
                >
                  {areAllStintsCollapsed ? (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      <span>Expandir Tudo</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      <span>Empacotar Tudo</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* DESKTOP TABLE (md+) */}
            <div className="hidden md:block">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#334155] bg-[#0f172a]/70 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-3 py-2.5">Stint</th>
                    <th className="px-2 py-2.5 text-center">Duração</th>
                    <th className="px-2 py-2.5 text-center">Voltas</th>
                    <th className="px-2 py-2.5 text-center">Piloto</th>
                    <th className="px-2 py-2.5 text-center">Pneus Início</th>
                    <th className="px-3 py-2.5 text-center">Pneus Fim</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155]/60">
                  {enrichedSchedule.map((row) => {
                    const isCollapsed = Boolean(collapsedStints[row.id]);
                    const nextStintLabel = `Stint ${String((row.stintNum || 0) + 1).padStart(2, '0')}`;
                    const rowAccentClass =
                      row.type === 'fp'
                        ? 'border-l-4 border-l-sky-400 bg-sky-950/20 hover:bg-sky-950/35'
                        : row.type === 'qualy'
                        ? 'border-l-4 border-l-[#eab308] bg-amber-950/20 hover:bg-amber-950/35'
                        : 'border-l-4 border-l-[#22c55e] bg-emerald-950/15 hover:bg-emerald-950/30';
                    const labelBadgeClass =
                      row.type === 'fp'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                        : row.type === 'qualy'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                    return (
                      <React.Fragment key={row.id}>
                        {isCollapsed ? (
                          <tr
                            className={`transition-colors ${rowAccentClass}`}
                          >
                            <td colSpan={6} className="px-3 py-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                                  <button
                                    type="button"
                                    onClick={() => toggleStintCollapse(row.id)}
                                    title="Expandir stint"
                                    className="inline-flex h-5 w-5 items-center justify-center rounded border border-[#334155] bg-[#0f172a] text-slate-400 hover:border-[#eab308]/60 hover:text-[#eab308] cursor-pointer"
                                  >
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  </button>
                                  <span
                                    className={`inline-flex h-2 w-2 rounded-full ${row.type === 'fp'
                                      ? 'bg-sky-400'
                                      : row.type === 'qualy'
                                        ? 'bg-[#eab308]'
                                        : 'bg-[#22c55e]'
                                      }`}
                                  />
                                  <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${labelBadgeClass}`}>{row.label}</span>
                                  <span className="font-mono tabular-nums text-[11px] text-slate-400">
                                    {formatMinutesToHHMM(row.startMin)} - {formatMinutesToHHMM(row.endMin)}
                                  </span>
                                  <span className="text-slate-600">•</span>
                                  <span className="font-mono text-[11px] text-slate-300">
                                    {row.durationMin.toFixed(1)} min ({row.laps} v)
                                  </span>
                                  <span className="text-slate-600">•</span>
                                  <span className="font-semibold text-amber-300">{row.driver}</span>
                                </div>
                                {row.type === 'race' && !row.isLastStint && (
                                  <span className="font-mono text-[11px] text-amber-400/90">
                                    Pit: {PIT_SCENARIOS.find((p) => p.id === row.pitScenario)?.label} ({row.pitDurationSec}s)
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <>
                            <tr
                              className={`transition-colors ${rowAccentClass}`}
                            >
                              {/* STINT + HORÁRIO */}
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleStintCollapse(row.id)}
                                    title="Minimizar stint"
                                    className="inline-flex h-5 w-5 items-center justify-center rounded border border-[#334155] bg-[#0f172a] text-slate-400 hover:border-[#eab308]/60 hover:text-[#eab308] cursor-pointer"
                                  >
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  </button>
                                  <span
                                    className={`inline-flex h-2 w-2 rounded-full ${row.type === 'fp'
                                      ? 'bg-sky-400'
                                      : row.type === 'qualy'
                                        ? 'bg-[#eab308]'
                                        : 'bg-[#22c55e]'
                                      }`}
                                  />
                                  <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${labelBadgeClass}`}>{row.label}</span>
                                </div>
                                <div className="mt-0.5 pl-9 font-mono tabular-nums text-[11px] text-slate-400">
                                  {formatMinutesToHHMM(row.startMin)} - {formatMinutesToHHMM(row.endMin)}
                                  {row.type === 'race' && !row.isLastStint && (
                                    <span className="ml-1.5 text-amber-400/90">
                                      (+{row.pitDurationSec}s pit)
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* DURAÇÃO */}
                              <td className="px-2 py-2.5 whitespace-nowrap font-mono tabular-nums text-center">
                                {row.type === 'fp' ? (
                                  <div className="inline-flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      value={params.fpDurationMin}
                                      onChange={(e) =>
                                        handleParamChange(
                                          'fpDurationMin',
                                          Math.max(0, Number(e.target.value) || 0)
                                        )
                                      }
                                      className="w-14 rounded border border-[#334155] bg-[#0f172a] px-1.5 py-1 text-xs text-slate-100 focus:border-[#eab308] focus:outline-none"
                                    />
                                    <span className="text-slate-400">min</span>
                                  </div>
                                ) : row.type === 'qualy' ? (
                                  <div className="inline-flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      value={params.qualyDurationMin}
                                      onChange={(e) =>
                                        handleParamChange(
                                          'qualyDurationMin',
                                          Math.max(0, Number(e.target.value) || 0)
                                        )
                                      }
                                      className="w-14 rounded border border-[#334155] bg-[#0f172a] px-1.5 py-1 text-xs text-slate-100 focus:border-[#eab308] focus:outline-none"
                                    />
                                    <span className="text-slate-400">min</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-200">{row.durationMin.toFixed(1)} min</span>
                                )}
                              </td>

                              {/* VOLTAS */}
                              <td className="px-2 py-2.5 whitespace-nowrap font-mono tabular-nums text-slate-200 text-center">
                                {row.laps} v
                              </td>

                              {/* PILOTO */}
                              <td className="px-2 py-2.5 text-center">
                                <div className="mx-auto flex flex-col items-center gap-1.5">
                                  <DriverAvatar90s driver={row.driver} size={48} />
                                  <select
                                    value={row.driver}
                                    onChange={(e) => {
                                      if (row.type === 'race') {
                                        updateRaceStint(row.stintNum, 'driver', e.target.value);
                                      } else {
                                        updatePreSession(row.type, 'driver', e.target.value);
                                      }
                                    }}
                                    className="w-full max-w-[140px] rounded-md border border-[#334155] bg-[#0f172a] px-2 py-1 text-xs font-medium text-slate-100 focus:border-[#eab308] focus:outline-none cursor-pointer"
                                  >
                                    {DRIVERS.map((d) => {
                                      const allowed = canAssignDriver(row.id, d);
                                      return (
                                        <option key={d} value={d} disabled={!allowed}>
                                          {d}{!allowed ? ' (limite 6)' : ''}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                              </td>

                              {/* PNEUS INÍCIO */}
                              <td className="px-2 py-2.5 whitespace-nowrap">
                                {row.type === 'fp' ? (
                                  <div className="flex justify-center">
                                    <span className="inline-flex items-center rounded border border-[#334155] bg-[#0f172a]/60 px-2.5 py-1 text-[11px] text-slate-400">
                                      Sem desgaste
                                    </span>
                                  </div>
                                ) : (
                                  <div className="mx-auto flex flex-col items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (row.type === 'race') {
                                          updateRaceStint(row.stintNum, 'tiresStart', DEFAULT_FULL_TIRES);
                                        } else {
                                          updatePreSession(row.type, 'tiresStart', DEFAULT_FULL_TIRES);
                                        }
                                      }}
                                      className="inline-flex items-center justify-center rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                                    >
                                      4 Pneus Novos
                                    </button>
                                    <div className="mx-auto grid w-[132px] grid-cols-2 gap-1.5">
                                      {TIRE_CORNERS.map(({ key }) => {
                                        const tireMeta = row.startTireMeta?.[key];
                                        const setStartVal = (val) => {
                                          if (row.type === 'race') {
                                            updateRaceStintTire(row.stintNum, 'tiresStart', key, val);
                                          } else {
                                            updatePreSessionTire(row.type, 'tiresStart', key, val);
                                          }
                                        };
                                        return (
                                          <StartTireToggleButton
                                            key={`start-${key}`}
                                            corner={key}
                                            tireMeta={tireMeta}
                                            onToggle={() => {
                                              if (tireMeta?.mode === 'new') {
                                                setStartVal(tireMeta?.canKeep ? 'keep' : 'ND');
                                              } else if (tireMeta?.mode === 'keep') {
                                                setStartVal('ND');
                                              } else {
                                                setStartVal(100);
                                              }
                                            }}
                                          />
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </td>

                              {/* PNEUS FIM */}
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                {row.type === 'fp' ? (
                                  <div className="flex justify-center">
                                    <span className="inline-flex items-center rounded border border-[#334155] bg-[#0f172a]/60 px-2.5 py-1 text-[11px] text-slate-400">
                                      Sem desgaste
                                    </span>
                                  </div>
                                ) : !row.tiresEndEnabled ? (
                                  <div className="flex justify-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (row.type === 'race') {
                                          updateRaceStint(row.stintNum, 'tiresEndEnabled', true);
                                        } else {
                                          updatePreSession(row.type, 'tiresEndEnabled', true);
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-300 transition-colors hover:border-amber-400 hover:bg-amber-500/20 cursor-pointer"
                                    >
                                      + Registrar Pneus
                                    </button>
                                  </div>
                                ) : (
                                  <div className="mx-auto flex flex-col items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (row.type === 'race') {
                                          updateRaceStint(row.stintNum, 'tiresEndEnabled', false);
                                        } else {
                                          updatePreSession(row.type, 'tiresEndEnabled', false);
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 rounded border border-slate-600/70 bg-slate-800/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-300 transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300 cursor-pointer"
                                    >
                                      × Desregistrar
                                    </button>
                                    <div className="grid w-[132px] grid-cols-2 gap-1.5">
                                      {TIRE_CORNERS.map(({ key }) => (
                                        <TireBadgeEditor
                                          key={`end-${key}`}
                                          corner={key}
                                          tireId={row.endTireMeta?.[key]?.tireId}
                                          value={row.tiresEnd[key]}
                                          onChange={(val) => {
                                            if (row.type === 'race') {
                                              updateRaceStintTire(row.stintNum, 'tiresEnd', key, val);
                                            } else {
                                              updatePreSessionTire(row.type, 'tiresEnd', key, val);
                                            }
                                          }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>

                            {row.type === 'race' && !row.isLastStint && (
                              <tr className="bg-amber-500/5 border-y border-amber-500/20">
                                <td colSpan={4} className="px-3 py-1.5">
                                  <div className="flex items-center gap-2 text-[11px]">
                                    <Wrench className="h-3.5 w-3.5 text-[#eab308]" />
                                    <span className="font-bold uppercase tracking-wider text-[#eab308]">
                                      Pitstop
                                    </span>
                                    <span className="text-slate-400">
                                      {row.label} → {nextStintLabel}
                                    </span>
                                    <span className="font-mono text-slate-300">
                                      ({formatMinutesToHHMM(row.endMin)})
                                    </span>
                                  </div>
                                </td>
                                <td colSpan={2} className="px-3 py-1.5 text-center">
                                  <select
                                    value={row.pitScenario}
                                    onChange={(e) =>
                                      updateRaceStint(row.stintNum, 'pitScenario', e.target.value)
                                    }
                                    className="mx-auto rounded-md border border-amber-500/35 bg-[#0f172a] px-2.5 py-1 text-xs font-medium text-slate-100 focus:border-[#eab308] focus:outline-none cursor-pointer"
                                  >
                                    {PIT_SCENARIOS.map((sc) => (
                                      <option key={sc.id} value={sc.id}>
                                        {sc.label} ({getPitTimeSeconds(sc.id, params)}s)
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            )}
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS (< md) */}
            <div className="space-y-2.5 p-2.5 bg-[#0f172a]/70 md:hidden">
              {enrichedSchedule.map((row) => {
                const isCollapsed = Boolean(collapsedStints[row.id]);
                const nextStintLabel = `Stint ${String((row.stintNum || 0) + 1).padStart(2, '0')}`;
                const cardColorClass =
                  row.type === 'fp'
                    ? 'border-sky-500/35 border-l-sky-400 bg-gradient-to-br from-sky-950/60 via-[#1e293b] to-[#172033]'
                    : row.type === 'qualy'
                    ? 'border-amber-500/40 border-l-[#eab308] bg-gradient-to-br from-amber-950/45 via-[#1e293b] to-[#172033]'
                    : 'border-emerald-500/35 border-l-[#22c55e] bg-gradient-to-br from-emerald-950/45 via-[#1e293b] to-[#172033]';
                const labelBadgeClass =
                  row.type === 'fp'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : row.type === 'qualy'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                return (
                  <React.Fragment key={row.id}>
                    <div className={`rounded-xl border border-l-4 p-3.5 space-y-3 shadow-md transition-colors ${cardColorClass}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleStintCollapse(row.id)}
                            title={isCollapsed ? 'Expandir stint' : 'Minimizar stint'}
                            className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#334155] bg-[#0f172a] text-slate-400 hover:text-[#eab308]"
                          >
                            {isCollapsed ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronUp className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <span
                            className={`inline-flex h-2.5 w-2.5 rounded-full ${row.type === 'fp'
                              ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]'
                              : row.type === 'qualy'
                                ? 'bg-[#eab308] shadow-[0_0_8px_rgba(234,179,8,0.7)]'
                                : 'bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.7)]'
                              }`}
                          />
                          <div>
                            <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-extrabold tracking-wide ${labelBadgeClass}`}>{row.label}</span>
                            {isCollapsed && (
                              <div className="text-[11px] font-semibold text-amber-300">
                                {row.driver}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right font-mono tabular-nums">
                          <div className="text-xs font-bold text-slate-100">
                            {formatMinutesToHHMM(row.startMin)} - {formatMinutesToHHMM(row.endMin)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {row.durationMin.toFixed(1)} min • {row.laps} voltas
                          </div>
                        </div>
                      </div>

                      {!isCollapsed && (
                        <>
                          <div className="flex items-center gap-3">
                            <DriverAvatar90s driver={row.driver} size={52} />
                            <div className="flex-1 min-w-0">
                              <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                                Piloto
                              </label>
                              <select
                                value={row.driver}
                                onChange={(e) => {
                                  if (row.type === 'race') {
                                    updateRaceStint(row.stintNum, 'driver', e.target.value);
                                  } else {
                                    updatePreSession(row.type, 'driver', e.target.value);
                                  }
                                }}
                                className="w-full rounded-md border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-xs text-slate-100 focus:border-[#eab308] focus:outline-none"
                              >
                                {DRIVERS.map((d) => {
                                  const allowed = canAssignDriver(row.id, d);
                                  return (
                                    <option key={d} value={d} disabled={!allowed}>
                                      {d}{!allowed ? ' (limite 6)' : ''}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          </div>

                          {row.type === 'fp' ? (
                            <div className="rounded-md border border-[#334155] bg-[#0f172a]/60 px-3 py-2 text-xs text-slate-400">
                              Free Practice sem desgaste de pneus
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div>
                                <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase text-slate-400">
                                  <span>Pneus Início (Toque para alternar)</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (row.type === 'race') {
                                        updateRaceStint(row.stintNum, 'tiresStart', DEFAULT_FULL_TIRES);
                                      } else {
                                        updatePreSession(row.type, 'tiresStart', DEFAULT_FULL_TIRES);
                                      }
                                    }}
                                    className="inline-flex items-center rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20"
                                  >
                                    4 Pneus Novos
                                  </button>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                  {TIRE_CORNERS.map(({ key }) => {
                                    const tireMeta = row.startTireMeta?.[key];
                                    const setStartVal = (val) => {
                                      if (row.type === 'race') {
                                        updateRaceStintTire(row.stintNum, 'tiresStart', key, val);
                                      } else {
                                        updatePreSessionTire(row.type, 'tiresStart', key, val);
                                      }
                                    };
                                    return (
                                      <StartTireToggleButton
                                        key={`m-start-${key}`}
                                        corner={key}
                                        tireMeta={tireMeta}
                                        onToggle={() => {
                                          if (tireMeta?.mode === 'new') {
                                            setStartVal(tireMeta?.canKeep ? 'keep' : 'ND');
                                          } else if (tireMeta?.mode === 'keep') {
                                            setStartVal('ND');
                                          } else {
                                            setStartVal(100);
                                          }
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                              </div>

                              <div>
                                <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase text-slate-400">
                                  <span>Pneus Fim — Borracha Restante</span>
                                  {row.tiresEndEnabled && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (row.type === 'race') {
                                          updateRaceStint(row.stintNum, 'tiresEndEnabled', false);
                                        } else {
                                          updatePreSession(row.type, 'tiresEndEnabled', false);
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 rounded border border-slate-600/70 bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300 transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300"
                                    >
                                      × Desregistrar
                                    </button>
                                  )}
                                </div>
                                {!row.tiresEndEnabled ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (row.type === 'race') {
                                        updateRaceStint(row.stintNum, 'tiresEndEnabled', true);
                                      } else {
                                        updatePreSession(row.type, 'tiresEndEnabled', true);
                                      }
                                    }}
                                    className="w-full rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 transition-colors hover:border-amber-400 hover:bg-amber-500/20"
                                  >
                                    + Registrar Desgaste de Fim de Stint
                                  </button>
                                ) : (
                                  <div className="grid grid-cols-4 gap-2">
                                    {TIRE_CORNERS.map(({ key }) => (
                                      <TireBadgeEditor
                                        key={`m-end-${key}`}
                                        corner={key}
                                        tireId={row.endTireMeta?.[key]?.tireId}
                                        value={row.tiresEnd[key]}
                                        onChange={(val) => {
                                          if (row.type === 'race') {
                                            updateRaceStintTire(row.stintNum, 'tiresEnd', key, val);
                                          } else {
                                            updatePreSessionTire(row.type, 'tiresEnd', key, val);
                                          }
                                        }}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {!isCollapsed && row.type === 'race' && !row.isLastStint && (
                      <div className="bg-amber-500/10 px-4 py-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <Wrench className="h-3.5 w-3.5 text-[#eab308]" />
                            <span className="font-bold uppercase tracking-wider text-[#eab308]">
                              Pitstop ({row.label} → {nextStintLabel})
                            </span>
                          </div>
                          <span className="font-mono text-slate-300">
                            {formatMinutesToHHMM(row.endMin)}
                          </span>
                        </div>
                        <select
                          value={row.pitScenario}
                          onChange={(e) =>
                            updateRaceStint(row.stintNum, 'pitScenario', e.target.value)
                          }
                          className="w-full rounded-md border border-amber-500/35 bg-[#0f172a] px-2.5 py-2 text-xs text-slate-100 focus:border-[#eab308] focus:outline-none"
                        >
                          {PIT_SCENARIOS.map((sc) => (
                            <option key={sc.id} value={sc.id}>
                              {sc.label} ({getPitTimeSeconds(sc.id, params)}s)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* BOTTOM PANEL: TIRE MANAGER (BEST TO REUSE) */}
          <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Disc className="h-4 w-4 text-[#22c55e]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Gerenciador de Pneus — Melhores para Reaproveitar
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                Análise automática por canto comparando as 2 melhores opções
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {TIRE_CORNERS.map(({ key, label }) => {
                const rec = tireRecommendations[key];
                const best = rec?.best;
                const second = rec?.secondBest;

                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setSelectedTireCornerModal(key)}
                    title={`Ver todos os pneus usados em ${key} (${label})`}
                    className="w-full text-left rounded-lg border border-[#334155] bg-[#0f172a]/90 p-3.5 flex flex-col justify-between cursor-pointer transition-colors hover:border-emerald-500/50 hover:bg-[#0f172a] active:scale-[0.99]"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-200">
                          {key} <span className="font-normal text-slate-400">({label})</span>
                        </span>
                        <span className="rounded bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#22c55e]">
                          SUGERIDO
                        </span>
                      </div>

                      {best ? (
                        <>
                          <div className="mt-2.5 flex items-baseline justify-between">
                            <span
                              className={`text-2xl font-extrabold font-mono tabular-nums ${getTireTextColor(
                                best.pct
                              )}`}
                            >
                              {best.pct}%
                            </span>
                            <span className="text-xs font-medium text-slate-300">
                              <span className="font-mono font-bold text-amber-300 mr-1">
                                {best.tireId}
                              </span>
                              ({best.sourceLabel})
                            </span>
                          </div>

                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={`h-full transition-all ${getTireBarColor(best.pct)}`}
                              style={{ width: `${best.pct}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Sem dados</span>
                        </div>
                      )}
                    </div>

                    {second && (
                      <div className="mt-3 border-t border-[#334155]/70 pt-2 flex items-center justify-between text-[11px] text-slate-400">
                        <span>2ª melhor opção:</span>
                        <span className="font-mono tabular-nums text-slate-300">
                          {second.pct}% ({second.tireId} • {second.sourceLabel})
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </section>
      </main>

      {/* TIRE CORNER RANKING MODAL */}
      {selectedTireCornerModal && (() => {
        const rec = tireRecommendations[selectedTireCornerModal];
        const items = rec?.all || [];
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => setSelectedTireCornerModal(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-[#334155] bg-[#0f172a] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#334155] bg-[#1e293b] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Disc className="h-4 w-4 text-[#22c55e]" />
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Pneus Usados — {rec?.key} ({rec?.label})
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Ordenados do melhor para o pior desgaste
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTireCornerModal(null)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#334155] bg-[#0f172a] text-slate-400 hover:text-white cursor-pointer"
                  title="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[65vh] overflow-y-auto p-4 space-y-2.5">
                {items.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <span>Nenhum pneu usado registrado para este lado.</span>
                  </div>
                ) : (
                  items.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-3 ${
                        idx === 0
                          ? 'border-emerald-500/45 bg-emerald-950/25'
                          : 'border-[#334155] bg-[#1e293b]/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-5 min-w-[24px] items-center justify-center rounded bg-[#0f172a] border border-[#334155] px-1.5 font-mono text-[11px] font-bold text-slate-300">
                            {idx + 1}º
                          </span>
                          <span className="font-mono text-xs font-bold text-amber-300">
                            {item.tireId}
                          </span>
                          <span className="text-xs text-slate-300">
                            ({item.sourceLabel})
                          </span>
                          {idx === 0 && (
                            <span className="rounded bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#22c55e]">
                              MELHOR
                            </span>
                          )}
                        </div>
                        <span
                          className={`font-mono text-base font-extrabold tabular-nums ${getTireTextColor(
                            item.pct
                          )}`}
                        >
                          {item.pct}%
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full transition-all ${getTireBarColor(item.pct)}`}
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* CIRCUIT PICKER MODAL */}
      {circuitModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setCircuitModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-[#334155] bg-[#0f172a] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#334155] bg-[#1e293b] px-4 py-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#eab308]" />
                <div>
                  <h3 className="text-sm font-bold text-white">Selecionar Circuito</h3>
                  <p className="text-[11px] text-slate-400">
                    Escolha a pista pelo país e traçado
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCircuitModalOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#334155] bg-[#0f172a] text-slate-400 hover:text-white cursor-pointer"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {LMU_CIRCUITS.map((circuit) => {
                const isSelected = circuit.id === selectedCircuit.id;
                return (
                  <button
                    type="button"
                    key={circuit.id}
                    onClick={() => {
                      handleParamChange('circuitId', circuit.id);
                      setCircuitModalOpen(false);
                    }}
                    className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/15 shadow-[0_0_12px_rgba(234,179,8,0.2)]'
                        : 'border-[#334155] bg-[#1e293b]/80 hover:border-amber-500/50 hover:bg-[#1e293b]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-lg leading-none">{circuit.flag}</span>
                      {isSelected && (
                        <span className="rounded bg-amber-500/20 border border-amber-500/50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300">
                          Atual
                        </span>
                      )}
                    </div>
                    <CircuitTrackSvg
                      svgPath={circuit.svgPath}
                      className={`my-2 h-12 w-full ${
                        isSelected ? 'text-[#eab308]' : 'text-slate-300'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-bold text-white leading-tight">
                        {circuit.shortName}
                      </div>
                      <div className="text-[10px] text-slate-400">{circuit.country}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CALENDAR EVENT DRIVER SIGNUP MODAL */}
      {calendarEventModal && (() => {
        const signups = eventSignups[calendarEventModal.id] || [];
        const availableDrivers = DRIVERS.filter((d) => d !== 'ND');
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={() => setCalendarEventModal(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-[#334155] bg-[#0f172a] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#334155] bg-[#1e293b] px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="h-4 w-4 shrink-0 text-[#eab308]" />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-white">
                      {calendarEventModal.track}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {calendarEventModal.dates} • {calendarEventModal.classes}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCalendarEventModal(null)}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#334155] bg-[#0f172a] text-slate-400 hover:text-white cursor-pointer"
                  title="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[72vh] overflow-y-auto p-4 space-y-4">
                <form onSubmit={handleSaveEventSignup} className="space-y-3 rounded-xl border border-[#334155] bg-[#1e293b]/70 p-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                      Pré-cadastro de Piloto
                    </label>
                    <select
                      value={signupDriverDraft}
                      onChange={(e) => {
                        const nextDrv = e.target.value;
                        setSignupDriverDraft(nextDrv);
                        const found = signups.find((s) => s.driver === nextDrv);
                        if (found?.classes?.length) setSignupClassesDraft(found.classes);
                      }}
                      className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-xs font-semibold text-white focus:border-[#eab308] focus:outline-none"
                    >
                      {availableDrivers.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase text-slate-400">
                      Categorias viáveis (marque uma ou mais)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {LMU_CAR_CLASSES.map((cls) => {
                        const checked = signupClassesDraft.includes(cls.id);
                        return (
                          <button
                            type="button"
                            key={cls.id}
                            onClick={() => toggleSignupClass(cls.id)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                              checked
                                ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                                : 'border-[#334155] bg-[#0f172a] text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span
                              className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded border text-[9px] ${
                                checked
                                  ? 'border-amber-400 bg-amber-400 text-slate-950'
                                  : 'border-slate-500'
                              }`}
                            >
                              {checked ? '✓' : ''}
                            </span>
                            {cls.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-lg bg-[#eab308] px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
                  >
                    Confirmar Pré-cadastro
                  </button>
                </form>

                <div>
                  <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    <span>Pilotos Pré-cadastrados ({signups.length})</span>
                  </div>
                  {signups.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[#334155] py-4 text-center text-xs text-slate-500">
                      Nenhum piloto pré-cadastrado nesta etapa ainda.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {signups.map((item) => (
                        <div
                          key={item.driver}
                          className="flex items-center justify-between gap-2 rounded-xl border border-[#334155] bg-[#1e293b]/80 px-3 py-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <DriverAvatar90s driver={item.driver} size={32} />
                            <div className="min-w-0">
                              <div className="truncate text-xs font-bold text-white">
                                {item.driver}
                              </div>
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {(item.classes || []).map((cid) => {
                                  const meta = LMU_CAR_CLASSES.find((c) => c.id === cid);
                                  return (
                                    <span
                                      key={cid}
                                      className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                        meta?.badgeClass || 'border-slate-600 text-slate-300'
                                      }`}
                                    >
                                      {meta?.label || cid}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveEventSignup(calendarEventModal.id, item.driver)}
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[#334155] bg-[#0f172a] text-slate-400 hover:text-red-400 cursor-pointer"
                            title="Remover pré-cadastro"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-[#334155] bg-[#0f172a]/95 px-4 py-3 text-xs font-semibold shadow-2xl backdrop-blur-md">
          <span
            className={`h-2 w-2 rounded-full ${toast.type === 'error'
              ? 'bg-red-400'
              : toast.type === 'warning'
                ? 'bg-[#eab308]'
                : 'bg-[#22c55e]'
              }`}
          />
          <span className="text-slate-100">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
