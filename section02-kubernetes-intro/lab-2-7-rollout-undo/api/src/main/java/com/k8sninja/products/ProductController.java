package com.k8sninja.products;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/products")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class ProductController {

    private final ProductRepository repo;

    // GET /api/products
    @GetMapping
    public ResponseEntity<Map<String,Object>> getAll(
            @RequestParam(required=false) String search) {
        log.info("[GET] /api/products - search={}", search);
        List<Product> products = (search != null)
            ? repo.findByNameContainingIgnoreCase(search)
            : repo.findAll();
        log.info("[GET] /api/products - {} productos encontrados", products.size());
        return ResponseEntity.ok(Map.of("data", products, "total", products.size()));
    }

    // GET /api/products/:id
    @GetMapping("/{id}")
    public ResponseEntity<Product> getOne(@PathVariable Long id) {
        log.info("[GET] /api/products/{}", id);
        return repo.findById(id)
            .map(p -> {
                log.info("[GET] /api/products/{} - encontrado: {}", id, p.getName());
                return ResponseEntity.ok(p);
            })
            .orElseGet(() -> {
                log.warn("[GET] /api/products/{} - no encontrado", id);
                return ResponseEntity.notFound().build();
            });
    }

    // POST /api/products
    @PostMapping
    public ResponseEntity<Product> create(@Valid @RequestBody Product product) {
        log.info("[POST] /api/products - creando: name={}, price={}", product.getName(), product.getPrice());
        product.setId(null);
        Product saved = repo.save(product);
        log.info("[POST] /api/products - creado con id={}", saved.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    // PUT /api/products/:id
    @PutMapping("/{id}")
    public ResponseEntity<Product> update(@PathVariable Long id,
                                           @Valid @RequestBody Product product) {
        log.info("[PUT] /api/products/{} - actualizando", id);
        if (!repo.existsById(id)) {
            log.warn("[PUT] /api/products/{} - no encontrado", id);
            return ResponseEntity.notFound().build();
        }
        product.setId(id);
        Product updated = repo.save(product);
        log.info("[PUT] /api/products/{} - actualizado: {}", id, updated.getName());
        return ResponseEntity.ok(updated);
    }

    // DELETE /api/products/:id
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        log.info("[DELETE] /api/products/{}", id);
        if (!repo.existsById(id)) {
            log.warn("[DELETE] /api/products/{} - no encontrado", id);
            return ResponseEntity.notFound().build();
        }
        repo.deleteById(id);
        log.info("[DELETE] /api/products/{} - eliminado", id);
        return ResponseEntity.noContent().build();
    }

    // GET /api/products/health
    @GetMapping("/health")
    public ResponseEntity<Map<String,String>> health() {
        long count = repo.count();
        log.info("[GET] /api/products/health - productos en BD: {}", count);
        return ResponseEntity.ok(Map.of(
            "status",   "UP",
            "products", String.valueOf(count)
        ));
    }
}
