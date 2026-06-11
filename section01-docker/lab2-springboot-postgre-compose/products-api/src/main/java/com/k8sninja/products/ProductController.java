package com.k8sninja.products;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

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
        List<Product> products = (search != null)
            ? repo.findByNameContainingIgnoreCase(search)
            : repo.findAll();
        return ResponseEntity.ok(Map.of(
            "data",  products,
            "total", products.size()
        ));
    }

    // GET /api/products/:id
    @GetMapping("/{id}")
    public ResponseEntity<Product> getOne(@PathVariable Long id) {
        return repo.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    // POST /api/products
    @PostMapping
    public ResponseEntity<Product> create(@Valid @RequestBody Product product) {
        product.setId(null);
        return ResponseEntity.status(HttpStatus.CREATED).body(repo.save(product));
    }

    // PUT /api/products/:id
    @PutMapping("/{id}")
    public ResponseEntity<Product> update(@PathVariable Long id,
                                           @Valid @RequestBody Product product) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        product.setId(id);
        return ResponseEntity.ok(repo.save(product));
    }

    // DELETE /api/products/:id
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // GET /api/products/health
    @GetMapping("/health")
    public ResponseEntity<Map<String,String>> health() {
        long count = repo.count();
        return ResponseEntity.ok(Map.of(
            "status",   "UP",
            "products", String.valueOf(count)
        ));
    }
}
