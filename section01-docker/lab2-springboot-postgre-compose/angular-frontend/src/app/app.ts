import { Component, OnInit, ViewChild, ElementRef, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ProductService } from './product.service';
import { Product } from './product.model';

declare const bootstrap: any;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  @ViewChild('productModal') modalRef!: ElementRef;

  products = signal<Product[]>([]);
  total = signal(0);
  loading = signal(false);
  error = signal('');

  search = '';
  saving = signal(false);
  formError = signal('');
  editingId: number | null = null;

  form: Product = { name: '', price: 0, stock: 0, description: '' };

  private modal: any = null;

  constructor(private svc: ProductService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.svc.getAll(this.search || undefined).subscribe({
      next: res => {
        this.products.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error al cargar los productos. Verifica que la API esté activa.');
        this.loading.set(false);
      }
    });
  }

  openCreate(): void {
    this.editingId = null;
    this.form = { name: '', price: 0, stock: 0, description: '' };
    this.formError.set('');
    this.getModal().show();
  }

  openEdit(p: Product): void {
    this.editingId = p.id ?? null;
    this.form = { ...p };
    this.formError.set('');
    this.getModal().show();
  }

  save(): void {
    if (!this.form.name.trim()) {
      this.formError.set('El nombre es requerido.');
      return;
    }
    if (this.form.price < 0 || this.form.stock < 0) {
      this.formError.set('Precio y stock deben ser valores positivos.');
      return;
    }
    this.saving.set(true);
    this.formError.set('');

    const obs = this.editingId
      ? this.svc.update(this.editingId, this.form)
      : this.svc.create(this.form);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.getModal().hide();
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.formError.set('Error al guardar. Intenta de nuevo.');
      }
    });
  }

  delete(p: Product): void {
    if (!confirm(`¿Eliminar "${p.name}"?`)) return;
    this.svc.delete(p.id!).subscribe({
      next: () => this.load(),
      error: () => this.error.set('Error al eliminar el producto.')
    });
  }

  private getModal(): any {
    if (!this.modal) {
      this.modal = new bootstrap.Modal(this.modalRef.nativeElement);
    }
    return this.modal;
  }
}
