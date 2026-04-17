package com.dairy.service;

import com.dairy.model.*;
import com.dairy.repo.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Random;

@Component("sampleDataInitializer")
public class SampleDataInitializer implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(SampleDataInitializer.class);

    @Autowired private CategoryRepository categoryRepository;
    @Autowired private HerdRepository herdRepository;
    @Autowired private CustomerRepository customerRepository;
    @Autowired private MilkRecordRepository milkRecordRepository;
    @Autowired private SaleRepository saleRepository;
    @Autowired private ExpenseRepository expenseRepository;
    @Autowired private IncomeRepository incomeRepository;
    @Autowired private StaffRepository staffRepository;
    @Autowired private InventoryRepository inventoryRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        logger.info("Starting Comprehensive Identity Seeding...");
        
        seedCategories();
        List<Herd> herds = seedHerds();
        List<Customer> customers = seedCustomers();
        List<Staff> staffList = seedStaff();
        seedInventory();
        seedTransactions(herds, customers);
        seedUsers(staffList, customers);
        
        logger.info("Identity Seeding finished.");
    }

    private void seedUsers(List<Staff> staffList, List<Customer> customerList) {
        createOrUpdateUser("srini", "srini.thewall@gmail.com", "admin123", Role.ADMIN, findStaffId(staffList, "Srinivas"), null);
        createOrUpdateUser("admin", "admin@dairy.com", "admin123", Role.ADMIN, null, null);
        for (Staff s : staffList) {
            String email = s.getName().toLowerCase().replace(" ", ".") + "@farm.com";
            createOrUpdateUser(s.getName().toLowerCase(), email, "pass123", Role.STAFF, s.getId(), null);
        }
    }

    private void createOrUpdateUser(String username, String email, String password, Role role, Long staffId, Long customerId) {
        Optional<User> existing = userRepository.findByEmail(email);
        User user = existing.orElse(new User());
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(role);
        user.setStaffId(staffId);
        user.setCustomerId(customerId);
        userRepository.save(user);
    }

    private Long findStaffId(List<Staff> list, String name) {
        return list.stream().filter(s -> s.getName().equalsIgnoreCase(name)).map(Staff::getId).findFirst().orElse(null);
    }

    private void seedCategories() {
        if (categoryRepository.count() > 0) return;
        
        // Expenses
        List<Category> expenses = Arrays.asList(
            new Category("Animal Feed", Category.CategoryType.EXPENSE, "🌾"),
            new Category("Medicine", Category.CategoryType.EXPENSE, "💊"),
            new Category("Electricity", Category.CategoryType.EXPENSE, "⚡"),
            new Category("Labor", Category.CategoryType.EXPENSE, "👷"),
            new Category("Water", Category.CategoryType.EXPENSE, "💧"),
            new Category("Equipment", Category.CategoryType.EXPENSE, "🚜"),
            new Category("Miscellaneous", Category.CategoryType.EXPENSE, "📦")
        );
        categoryRepository.saveAll(expenses);

        // Income
        List<Category> income = Arrays.asList(
            new Category("Milk Sale", Category.CategoryType.INCOME, "🥛"),
            new Category("Manure Sale", Category.CategoryType.INCOME, "💩"),
            new Category("Animal Sale", Category.CategoryType.INCOME, "🐄"),
            new Category("Subsidy", Category.CategoryType.INCOME, "🏦"),
            new Category("Miscellaneous", Category.CategoryType.INCOME, "💰")
        );
        categoryRepository.saveAll(income);
    }

    private List<Herd> seedHerds() {
        if (herdRepository.count() > 0) return herdRepository.findAll();
        LocalDate pDate = LocalDate.of(2026, 10, 14);
        List<Herd> herds = Arrays.asList(
            createFullHerd("COW-A2-101", "COW", "Gir", "A2", "Lakshmi", "Brought from Rajasthan", "/images/herds/gir_cow_a2.png", true, false, pDate),
            createFullHerd("COW-A2-102", "COW", "Jersey", "A2", "Meenakshi", "Karnal Farm", "/images/herds/gir_cow_a2.png", true, false, pDate),
            createFullHerd("COW-101", "COW", "Gir", "A1", "Nanda", "Direct Farm Birth", "/images/herds/gir_cow_a2.png", false, true, pDate),
            createFullHerd("BUF-301", "BUFFALO", "Murrah", "A2", "Rajeshwari", "Punjab Dairy", "/images/herds/murrah_buffalo.png", true, false, pDate),
            createFullHerd("GOAT-501", "GOAT", "Jamnapari", "N/A", "Muni", "Sthirvaa Direct", "/images/herds/jamnapari_goat.png", false, false, pDate)
        );
        return herdRepository.saveAll(herds);
    }

    private Herd createFullHerd(String tag, String type, String breed, String bType, String name, String source, String imageUrl, boolean l, boolean c, LocalDate d) {
        Herd h = new Herd();
        h.setTagNumber(tag);
        h.setAnimalType(type);
        h.setBreed(breed);
        h.setBreedType(bType);
        h.setAnimalName(name);
        h.setSource(source);
        h.setImageUrl(imageUrl);
        h.setLactating(l);
        h.setCalf(c);
        h.setProcuredDate(d);
        h.setBirthDate(LocalDate.now().minusYears(3));
        h.setHealthStatus("HEALTHY");
        return h;
    }

    private List<Customer> seedCustomers() {
        if (customerRepository.count() > 0) return customerRepository.findAll();
        return customerRepository.saveAll(Arrays.asList(
            createCustomer("Amul Parlour", "9876543210", "Hoskote Main Road"),
            createCustomer("Priya Sharma", "9123456789", "Whitefield Apartment")
        ));
    }

    private Customer createCustomer(String name, String phone, String addr) {
        Customer c = new Customer();
        c.setName(name);
        c.setPhone(phone);
        c.setAddress(addr);
        return c;
    }

    private List<Staff> seedStaff() {
        if (staffRepository.count() > 0) return staffRepository.findAll();
        String[][] staffData = {
            {"Srinivas", "Managing Partner – Operations & Growth", "BUSINESS", "Leads overall business strategy, investments, procurement of cows and raw materials, marketing, customer acquisition, sales, technology development, and partnership growth.", "9988776655", "Bengaluru"},
            {"Bhavya", "Partner – Finance & Research", "BUSINESS", "Oversees financial planning and high-level accounting, contributes to product ideas, focuses on food technology, research initiatives, and future business expansion.", "9988776654", "Bengaluru"},
            {"Lokesh", "Farm Operations Manager", "STAFF", "Manages daily farm operations, supervises staff, allocates tasks, oversees cattle care, feed management, and ensures efficient production and resource utilization.", "9988776653", "Sthirvaa Farm, Hoskote"}
        };
        for (String[] s : staffData) {
            Staff st = new Staff();
            st.setName(s[0]); st.setRole(s[1]); st.setType(s[2]); st.setDescription(s[3]); st.setPhone(s[4]); st.setLocation(s[5]);
            st.setJoinDate(LocalDate.now().minusMonths(6));
            staffRepository.save(st);
        }
        return staffRepository.findAll();
    }

    private void seedInventory() {
        if (inventoryRepository.count() > 0) return;
        Inventory i = new Inventory();
        i.setItemName("Green Fodder"); i.setQuantity(500.0); i.setUnit("KG"); i.setReorderLevel(100.0);
        inventoryRepository.save(i);
    }

    private void seedTransactions(List<Herd> herds, List<Customer> customers) {
        if (saleRepository.count() > 0) return;
        for (int i = 0; i < 3; i++) {
            Sale sale = new Sale();
            sale.setCustomer(customers.get(0)); sale.setItemName("Milk"); sale.setQuantity(10.0); sale.setPrice(50.0); sale.setTotalAmount(500.0);
            sale.setDate(LocalDate.now().minusDays(i)); sale.setPaymentStatus("PAID");
            saleRepository.save(sale);
        }
    }
}
