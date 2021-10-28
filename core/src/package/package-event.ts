interface IPackageEvent {
  message: string;
  took?: number;
  megabytes?: {
    code: number;
    layer?: number;
  };
  overall?: number;
}
