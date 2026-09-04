export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type VehicleData = {
  licensePlate: string;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  vin?: string | null;
  engine?: string | null;
  engineDisplacement?: number | null;
  enginePower?: number | null;
  fuelType?: string | null;
  bodyType?: string | null;
  color?: string | null;
  registrationDate?: string | null;
  raw?: Json;
};

export type ServiceItem = {
  id: string;
  name: string;
  description?: string;
  price: number;
  vat?: number;
  unitId?: number;
  moloniProductId?: number;
};

export type ServicePackage = {
  id: string;
  name: string;
  description?: string;
  discount?: number;
  services: Array<{ serviceId: string; quantity: number }>;
};

export type LiftId = "LIFT_1" | "LIFT_2" | "LIFT_3" | "LIFT_4";

export type CalendarAppointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  liftId: LiftId;
  leadId?: number;
  contactId?: number;
  dealId?: number;
  clientName?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  serviceIds: string[];
  packageIds: string[];
  notes?: string;
};

export type MoloniProduct = {
  product_id?: number;
  name: string;
  reference?: string;
  price: number;
  vat_type?: number;
  unit_id?: number;
  has_stock?: number;
  stock?: number;
  category_id?: number;
};

export type MoloniEstimateLine = {
  product_id?: number;
  name: string;
  qty: number;
  price: number;
  discount?: number;
  vat_type?: number;
  unit_id?: number;
};

export type MoloniCustomer = {
  customer_id?: number;
  name: string;
  email?: string;
  phone?: string;
  vat?: string;
  address?: string;
  city?: string;
  zip_code?: string;
  country_id?: number;
  language_id?: number;
  payment_day?: number;
  discount?: number;
};
