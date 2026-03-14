
/**
 * @typedef {Object} ArbitrageLine
 * @property {Money} min
 * @property {number} realms
 */

/**
 * @typedef {Object} Auction
 * @property {Money} price
 * @property {number} quantity
 */

/**
 * @typedef {Object} AuctionDetail
 * @property {number[]} bonuses
 * @property {Object.<number, number>} modifiers
 * @property {Money} price
 * @property {number[]} stats List of unique tertiary stat IDs
 */

/** @typedef {number} BattlePetSpeciesID */

/**
 * @typedef {Object} BattlePetSpecies
 * @property {number} display
 * @property {number} expansion
 * @property {string} icon
 * @property {number} npc
 * @property {number} [side]
 * @property {number} type
 */

/**
 * @typedef {Object} BattlePetStats
 * @property {number} power
 * @property {number} stamina
 * @property {number} speed
 */

/** @typedef {number} ClassID */

/** @typedef {number} ConnectedRealmID */

/**
 * @typedef {Object} ConnectedRealm
 * @property {Region} region
 * @property {ConnectedRealmID} id
 * @property {Realm} canonical
 * @property {Realm[]} secondary
 */

/**
 * @typedef {Object} DealsPrices
 * @property {Money} regionMedian
 * @property {Money} dealPrice
 */

/**
 * @typedef {object} DealsState
 * @property {Object<ItemKeyString, DealsPrices>} items
 */

/** @typedef {number} InventoryType */

/** @typedef {number} ItemID */

/** @typedef {string} ItemKeyString */

/** @typedef {number} SuffixID */

/**
 * @typedef {object} ItemKey
 * @property {ItemID} itemId
 * @property {number} itemLevel
 * @property {SuffixID} itemSuffix
 */

/** @typedef {number} Money  Expressed in coppers. */

/**
 * @typedef {UnnamedItem} Item
 * @property {BattlePetStats} [battlePetStats]
 * @property {number} [battlePetType]
 * @property {number} bonusLevel
 * @property {SuffixID} bonusSuffix
 * @property {ItemID} id
 * @property {string} name
 * @property {number} [npc]
 */

/**
 * @typedef {object} ItemState
 * @property {Auction[]}       auctions   An array of distinct prices and quantities, ordered by price ascending
 * @property {SummaryLine[]}   daily      A list of summary prices by day, order by snapshot ascending
 * @property {Item}            item
 * @property {Realm}           realm
 * @property {Money}           price      The cheapest price when this item was last seen
 * @property {number}          quantity   How many were available when this was last seen
 * @property {Timestamp}       snapshot   The last snapshot when this item was seen
 * @property {SummaryLine[]}   snapshots  An array of summary prices, order by snapshot ascending
 * @property {AuctionDetail[]} specifics  An array of prices and bonus information, ordered by price ascending
 */

/**
 * @typedef {Item} PricedItem Only to be used in search result lists.
 * @property {Money}     price
 * @property {number}    quantity
 * @property {Money}     [regionMedian]
 * @property {Timestamp} snapshot
 */

/**
 * @typedef {Object} Realm
 * @property {string}           category
 * @property {ConnectedRealmID} connectedId
 * @property {RealmID}          id
 * @property {string}           name
 * @property {string}           [nativeName]
 * @property {number}           population
 * @property {string}           populationName
 * @property {Region}           region
 * @property {string}           slug
 */

/** @typedef {number} RealmID */

/**
 * @typedef {Object} RealmState
 * @property {Realm} realm
 * @property {Timestamp} snapshot   The timestamp of the most recent snapshot
 * @property {Timestamp} lastCheck  The timestamp when we last checked for a new snapshot
 * @property {Timestamp[]} snapshots  An array of snapshot timestamps, in ascending order
 * @property {Object.<ItemKeyString, SummaryLine>} summary
 * @property {Object.<ItemID, Array<ItemKeyString>>} variants
 * @property {Object.<BattlePetSpeciesID, Array<ItemKeyString>>} speciesVariants
 * @property {Object.<StatID, Array<ItemKeyString>>} bonusStatItems
 */

/** @typedef {string} Region "us" or "eu", etc. */

/**
 * @typedef {object} RegionState
 * @property {Region} region
 * @property {Object.<ItemKeyString, ArbitrageLine>} arbitrage
 * @property {Object.<ItemID, Array<ItemKeyString>>} arbitrageVariants
 * @property {Object.<BattlePetSpeciesID, Array<ItemKeyString>>} arbitrageSpeciesVariants
 * @property {Object.<ItemKeyString, Money>} items
 */

/** @typedef {number} StatID */

/** @typedef {number} SubclassID */

/**
 * @typedef {Object} SummaryLine
 * @property {Timestamp} snapshot  When this item was last seen
 * @property {Money}     price     The cheapest price when it was last seen
 * @property {number}    quantity  The total quantity available when it was last seen
 */

/** @typedef {number} Timestamp  A UNIX timestamp, in milliseconds. */

/**
 * @typedef {object} TokenState
 * @property {Region}        region
 * @property {Money}         price
 * @property {Timestamp}     snapshot   When the token price last changed
 * @property {SummaryLine[]} snapshots  An array of prices, order by snapshot ascending
 */

/**
 * @typedef {object} UnnamedItem
 * @property {boolean} [bop]
 * @property {number} class
 * @property {number} [craftingQualityTier]
 * @property {number} [display]
 * @property {number} expansion
 * @property {number[]} [extraFilters]
 * @property {string} icon
 * @property {InventoryType} [inventoryType]
 * @property {number} [itemLevel]
 * @property {number} quality
 * @property {number} [reqLevel]
 * @property {number} [side]
 * @property {number} [slots]
 * @property {number} [squishEra]
 * @property {number} [squishedItemLevel]
 * @property {number} [stack]
 * @property {number} subclass
 * @property {number} [vendorBuy]
 * @property {number} [vendorSell]
 * @property {number} [vendorSellBase]
 * @property {number} [vendorSellFactor]
 */
