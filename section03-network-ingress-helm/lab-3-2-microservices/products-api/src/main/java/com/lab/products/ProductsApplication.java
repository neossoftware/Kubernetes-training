package com.lab.products;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import java.math.BigDecimal;

@SpringBootApplication
public class ProductsApplication {

    public static void main(String[] args) {
        SpringApplication.run(ProductsApplication.class, args);
    }

    @Bean
    CommandLineRunner seedData(ProductRepository repo) {
        return args -> {
            if (repo.count() == 0) {
                repo.save(new Product(null, "Laptop Pro 15",      new BigDecimal("1299.99"), 10, "Laptop de alto rendimiento"));
                repo.save(new Product(null, "Monitor 4K 27\"",    new BigDecimal("449.99"),  25, "Monitor UltraHD con panel IPS"));
                repo.save(new Product(null, "Teclado Mecánico",   new BigDecimal("89.99"),   50, "Switches Cherry MX Red"));
                repo.save(new Product(null, "Mouse Inalámbrico",  new BigDecimal("39.99"),   75, "2.4GHz, batería 12 meses"));
            }
        };
    }
}
