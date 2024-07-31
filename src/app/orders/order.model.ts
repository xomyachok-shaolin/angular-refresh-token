export interface Service {
  uuid: string;
  title: string;
  parameters: any[];
}
export interface Order {
  uuid: string;
  orderNumber: string;
  contractNumber: string;
  paymentStatus: string;
  executionStatus: string;
  execution: Date;
  paymentDate: Date;
  linkToGeoData: string;
  passwordForLink: string;
  comment: string;
  cost: number;
  client: string;
  archived: boolean;
  service: Service[] | null;
  selected?: boolean;
}
