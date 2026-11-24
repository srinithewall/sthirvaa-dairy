package com.dairy.config;

import com.dairy.model.SireBull;
import com.dairy.repo.SireBullRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Loads the Alamadhi Semen Station sire directory (resources/sires/alamadhi_sires.psv) into
 * sire_bulls. New bulls are inserted; for bulls already there only empty fields are filled,
 * so anything edited in the app is never overwritten.
 */
@Component
public class SireCatalogSeeder implements CommandLineRunner {

    static final String STATION = "Alamadhi Semen Station";
    private final SireBullRepository repo;

    public SireCatalogSeeder(SireBullRepository repo) { this.repo = repo; }

    @Override
    public void run(String... args) {
        try {
            List<SireBull> rows = parse();
            Map<String, SireBull> existing = new HashMap<>();
            for (SireBull s : repo.findAll()) existing.put(s.getBullNo(), s);
            List<SireBull> toSave = new ArrayList<>();
            for (SireBull r : rows) {
                SireBull e = existing.get(r.getBullNo());
                if (e == null) { toSave.add(r); continue; }
                if (fillBlanks(e, r)) toSave.add(e);
            }
            if (!toSave.isEmpty()) repo.saveAll(toSave);
            System.out.println("Sire catalogue: " + rows.size() + " bulls in seed, " + toSave.size() + " inserted/updated");
        } catch (Exception ex) {
            System.out.println("Sire catalogue seed skipped: " + ex.getMessage());
        }
    }

    static List<SireBull> parse() throws Exception {
        List<SireBull> out = new ArrayList<>();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(
                new ClassPathResource("sires/alamadhi_sires.psv").getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = br.readLine()) != null) {
                if (line.isBlank() || line.startsWith("#")) continue;
                String[] c = Arrays.copyOf(line.split("\\|", -1), 18);
                SireBull s = new SireBull();
                s.setBullNo(c[0].trim().toUpperCase(Locale.ROOT));
                s.setBullName(str(c[1]));
                s.setCategory(str(c[2]));
                s.setBreed(str(c[3]));
                s.setDamBestYieldKg(num(c[4]));
                s.setDamFatPct(num(c[5]));
                s.setStarValue(str(c[6]));
                s.setInaphId(str(c[7]));
                s.setDateOfBirth(str(c[8]));
                s.setDamNo(str(c[9]));
                s.setDamName(str(c[10]));
                s.setSireNo(str(c[11]));
                s.setSireName(str(c[12]));
                s.setSireDamBestYieldKg(num(c[13]));
                s.setSireDaughtersYieldKg(num(c[14]));
                s.setBreedingValue(num(c[15]));
                s.setImageUrl(str(c[16]));
                s.setSourceUrl(str(c[17]));
                s.setStation(STATION);
                if (!s.getBullNo().isEmpty()) out.add(s);
            }
        }
        return out;
    }

    /** Copies seed values into fields that are still empty; true if anything changed. */
    static boolean fillBlanks(SireBull e, SireBull r) {
        boolean[] changed = {false};
        fill(e::getBullName, e::setBullName, r.getBullName(), changed);
        fill(e::getCategory, e::setCategory, r.getCategory(), changed);
        fill(e::getBreed, e::setBreed, r.getBreed(), changed);
        fill(e::getDamBestYieldKg, e::setDamBestYieldKg, r.getDamBestYieldKg(), changed);
        fill(e::getDamFatPct, e::setDamFatPct, r.getDamFatPct(), changed);
        fill(e::getStarValue, e::setStarValue, r.getStarValue(), changed);
        fill(e::getInaphId, e::setInaphId, r.getInaphId(), changed);
        fill(e::getDateOfBirth, e::setDateOfBirth, r.getDateOfBirth(), changed);
        fill(e::getDamNo, e::setDamNo, r.getDamNo(), changed);
        fill(e::getDamName, e::setDamName, r.getDamName(), changed);
        fill(e::getSireNo, e::setSireNo, r.getSireNo(), changed);
        fill(e::getSireName, e::setSireName, r.getSireName(), changed);
        fill(e::getSireDamBestYieldKg, e::setSireDamBestYieldKg, r.getSireDamBestYieldKg(), changed);
        fill(e::getSireDaughtersYieldKg, e::setSireDaughtersYieldKg, r.getSireDaughtersYieldKg(), changed);
        fill(e::getBreedingValue, e::setBreedingValue, r.getBreedingValue(), changed);
        fill(e::getImageUrl, e::setImageUrl, r.getImageUrl(), changed);
        fill(e::getSourceUrl, e::setSourceUrl, r.getSourceUrl(), changed);
        fill(e::getStation, e::setStation, r.getStation(), changed);
        return changed[0];
    }

    private static <T> void fill(Supplier<T> get, Consumer<T> set, T v, boolean[] changed) {
        T cur = get.get();
        boolean empty = cur == null || (cur instanceof String str && str.isBlank());
        if (empty && v != null) { set.accept(v); changed[0] = true; }
    }

    private static String str(String s) { return s == null || s.isBlank() ? null : s.trim(); }

    private static Double num(String s) {
        try { return s == null || s.isBlank() ? null : Double.parseDouble(s.trim()); }
        catch (NumberFormatException e) { return null; }
    }
}
