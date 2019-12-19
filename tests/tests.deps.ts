import { test, runTests } from "https://deno.land/std/testing/mod.ts";
import { assert, assertNotEquals, assertEquals, assertThrows, fail } from "https://deno.land/std/testing/asserts.ts";

import { difference } from "../src/deps.ts";

test({
    name: "Difference tests",
    fn: function diffTests():void {
        assertEquals(difference([1, 2, 3, 4, 5], [5, 2, 10]), [1, 3, 4], "Basic array diff");
    }
});

runTests();