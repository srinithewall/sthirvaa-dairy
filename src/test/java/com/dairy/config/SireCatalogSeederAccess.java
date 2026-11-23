package com.dairy.config;

import com.dairy.model.SireBull;

import java.util.List;

/** Test bridge to the package-private seed parser. */
public final class SireCatalogSeederAccess {
    private SireCatalogSeederAccess() {}
    public static List<SireBull> parse() throws Exception { return SireCatalogSeeder.parse(); }
}
