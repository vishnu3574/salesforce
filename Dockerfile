FROM eclipse-temurin:17-jdk
WORKDIR /app

# Copy maven wrapper first for better caching
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x ./mvnw

# Copy source and build
COPY src ./src
RUN ./mvnw clean package -DskipTests

EXPOSE 8080
CMD ["java", "-jar", "target/*.jar"]
