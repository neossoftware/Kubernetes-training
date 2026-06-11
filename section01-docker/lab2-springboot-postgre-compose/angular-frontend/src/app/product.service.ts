import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product, ProductsResponse } from './product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {

  private apiUrl = (window as any).__env?.API_URL ?? 'http://localhost:8080';

  constructor(private http: HttpClient) {}

  getAll(search?: string): Observable<ProductsResponse> {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.http.get<ProductsResponse>(`${this.apiUrl}/api/products${params}`);
  }

  getOne(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/api/products/${id}`);
  }

  create(product: Product): Observable<Product> {
    return this.http.post<Product>(`${this.apiUrl}/api/products`, product);
  }

  update(id: number, product: Product): Observable<Product> {
    return this.http.put<Product>(`${this.apiUrl}/api/products/${id}`, product);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/products/${id}`);
  }
}
