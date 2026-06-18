package com.lab.customers;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class CustomersApplication {

    public static void main(String[] args) {
        SpringApplication.run(CustomersApplication.class, args);
    }

    @Bean
    CommandLineRunner seedData(CustomerRepository repo) {
        return args -> {
            if (repo.count() == 0) {
                repo.save(new Customer(null, "Ana García",    "ana@empresa.com",    "+52 55 1234 5678", null));
                repo.save(new Customer(null, "Carlos López",  "carlos@empresa.com", "+52 55 8765 4321", null));
                repo.save(new Customer(null, "María Rodríguez","maria@empresa.com", "+52 55 5555 0000", null));
            }
        };
    }
}
