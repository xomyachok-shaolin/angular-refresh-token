export interface Service {
parameters: any;
  uuid: string;
  title: string;
  cost: number;
  description?: string;
  files?: string[] | null;
}
export interface Order {
  uuid: string;
  orderNumber: string;
  contractNumber: string;
  paymentStatus: string;
  executionStatus: string;
  execution: Date;
  created: Date;
  linkToGeoData: string;
  passwordForLink: string;
  comment: string;
  cost: number;
  client: string;
  archived: boolean;
  service: Service[] | null;
  selected?: boolean;
}
