package backendcontroller;

import backendservice.SalesforceService; 
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:5173") // Change to 3000 if using CRA/Vite
public class SalesforceController {

    private final SalesforceService sfdcService;
    
    public SalesforceController(SalesforceService sfdcService) { 
        this.sfdcService = sfdcService; 
    }

    // 1. READ ALL - Get 20 records with pagination
    // Example: GET /api/Account?page=0
    @GetMapping("/{object}")
    public ResponseEntity<List<Map<String, Object>>> getRecords(
            @PathVariable String object, // Account, Opportunity, Lead, Contact, Case
            @RequestParam(defaultValue = "0") int page) {
        try {
            List<Map<String, Object>> records = sfdcService.getRecords(object, page);
            return ResponseEntity.ok(records);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(null);
        }
    }

    // 2. READ ONE - Get single record by Id
    // Example: GET /api/Contact/003xx000001
    @GetMapping("/{object}/{id}")
    public ResponseEntity<Map<String, Object>> getById(
            @PathVariable String object, 
            @PathVariable String id) {
        try {
            Map<String, Object> record = sfdcService.getById(object, id);
            return ResponseEntity.ok(record);
        } catch (Exception e) {
            return ResponseEntity.status(404).body(null);
        }
    }

    // 3. CREATE - New Record
    // Example: POST /api/Lead
    @PostMapping("/{object}")
    public ResponseEntity<Map<String, Object>> create(
            @PathVariable String object, 
            @RequestBody Map<String, String> data) {
        try {
            Map<String, Object> result = sfdcService.createRecord(object, data);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(400).body(null);
        }
    }

    // 4. UPDATE - Record by Id
    // Example: PUT /api/Opportunity/006xx000001
    @PutMapping("/{object}/{id}")
    public ResponseEntity<String> update(
            @PathVariable String object, 
            @PathVariable String id, 
            @RequestBody Map<String, Object> data) {
        try {
            String result = sfdcService.updateRecord(object, id, data);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(400).body("Update failed");
        }
    }

    // 5. DELETE - Record by Id
    // Example: DELETE /api/Case/500xx000001
    @DeleteMapping("/{object}/{id}")
    public ResponseEntity<String> delete(
            @PathVariable String object, 
            @PathVariable String id) {
        try {
            String result = sfdcService.deleteRecord(object, id);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(400).body("Delete failed");
        }
    }
}