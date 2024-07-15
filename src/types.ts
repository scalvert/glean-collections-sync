export interface Filter {
  value: string;
  relationType: string;
}

export interface FilterDict {
  [key: string]: Filter[];
}

export interface CollectionResponse {
  errorCode?: string;
  id?: number;
  collections?: Collection[];
}

export interface Collection {
  id: number;
  name: string;
}
