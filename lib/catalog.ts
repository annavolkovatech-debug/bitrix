import { ServiceItem, ServicePackage } from "./types";

export const SERVICES: ServiceItem[] = [
  { id: "SVC_001", name: "Замена масла", description: "Замена масла двигателя + фильтр", price: 1500, vat: 0, unitId: 1 },
  { id: "SVC_002", name: "Диагностика двигателя", description: "Компьютерная диагностика OBD", price: 1200, vat: 0, unitId: 1 },
  { id: "SVC_003", name: "Балансировка колёс", description: "Балансировка 4 колёс", price: 1000, vat: 0, unitId: 1 },
  { id: "SVC_004", name: "Сезонная смена шин", description: "Смена + монтаж + балансировка", price: 2500, vat: 0, unitId: 1 },
  { id: "SVC_005", name: "Замена тормозных колодок", description: "Передняя ось", price: 2200, vat: 0, unitId: 1 },
  { id: "SVC_006", name: "Замена тормозных дисков", description: "Передняя ось (пара)", price: 4800, vat: 0, unitId: 1 },
  { id: "SVC_007", name: "Развал-схождение", description: "Регулировка углов установки колёс", price: 1800, vat: 0, unitId: 1 },
  { id: "SVC_008", name: "Заправка кондиционера", description: "Диагностика + заправка фреоном", price: 2300, vat: 0, unitId: 1 },
  { id: "SVC_009", name: "Комплексная мойка", description: "Мойка кузова + салон + химчистка", price: 1700, vat: 0, unitId: 1 },
  { id: "SVC_010", name: "Замена аккумулятора", description: "Диагностика + замена АКБ", price: 500, vat: 0, unitId: 1 },
];

export const SERVICE_PACKAGES: ServicePackage[] = [
  {
    id: "PKG_TO",
    name: "ТО 15 000 км",
    description: "Замена масла, фильтров, диагностика",
    discount: 5,
    services: [
      { serviceId: "SVC_001", quantity: 1 },
      { serviceId: "SVC_002", quantity: 1 },
    ],
  },
  {
    id: "PKG_BALANCE",
    name: "Балансировка колёс",
    description: "Балансировка + сезонная смена со скидкой",
    discount: 10,
    services: [
      { serviceId: "SVC_003", quantity: 1 },
      { serviceId: "SVC_004", quantity: 1 },
    ],
  },
  {
    id: "PKG_BRAKES",
    name: "Тормозная система",
    description: "Полная замена передних тормозов",
    discount: 8,
    services: [
      { serviceId: "SVC_005", quantity: 1 },
      { serviceId: "SVC_006", quantity: 1 },
    ],
  },
  {
    id: "PKG_PRESEASON",
    name: "Подготовка к сезону",
    description: "Шиномонтаж + развал + кондиционер",
    discount: 12,
    services: [
      { serviceId: "SVC_004", quantity: 1 },
      { serviceId: "SVC_007", quantity: 1 },
      { serviceId: "SVC_008", quantity: 1 },
    ],
  },
];

export const LIFTS = [
  { id: "LIFT_1" as const, name: "Подъёмник 1" },
  { id: "LIFT_2" as const, name: "Подъёмник 2" },
  { id: "LIFT_3" as const, name: "Подъёмник 3" },
  { id: "LIFT_4" as const, name: "Подъёмник 4" },
];
