# Stage 1: Build del JAR
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app

# Cachear dependencias Maven separado del código
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN ./mvnw dependency:go-offline -B

# Compilar
COPY src ./src
RUN ./mvnw package -DskipTests -B

# Extraer capas del JAR para optimizar Docker layers
RUN java -Djarmode=layertools -jar target/*.jar extract

# Stage 2: Imagen final mínima solo con JRE
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Usuario no-root
RUN addgroup -S spring && adduser -S spring -G spring

# Copiar capas en orden (las que menos cambian primero)
COPY --from=build /app/dependencies/          ./
COPY --from=build /app/spring-boot-loader/    ./
COPY --from=build /app/snapshot-dependencies/ ./
COPY --from=build /app/application/           ./

RUN chown -R spring:spring /app
USER spring

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/actuator/health || exit 1

ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
