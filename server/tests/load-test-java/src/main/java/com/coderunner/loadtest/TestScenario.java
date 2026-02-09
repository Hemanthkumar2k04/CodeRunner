package com.coderunner.loadtest;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Test scenarios with code samples for different languages
 */
public class TestScenario {
    private final String language;
    private final String name;
    private final JsonArray files;

    private static final Random random = new Random();

    public TestScenario(String language, String name, JsonArray files) {
        this.language = language;
        this.name = name;
        this.files = files;
    }

    public String getLanguage() {
        return language;
    }

    public String getName() {
        return name;
    }

    public JsonArray getFiles() {
        return files;
    }

    /**
     * Create a file JSON object
     */
    private static JsonObject createFile(String name, String path, String content, boolean toBeExec) {
        JsonObject file = new JsonObject();
        file.addProperty("name", name);
        file.addProperty("path", path);
        file.addProperty("content", content);
        file.addProperty("toBeExec", toBeExec);
        return file;
    }

    /**
     * Python hello world scenario
     */
    public static TestScenario pythonHelloWorld() {
        JsonArray files = new JsonArray();
        files.add(createFile(
                "main.py",
                "main.py",
                "print('Hello from Python!')\nprint('Load test execution')\n",
                true));
        return new TestScenario("python", "python_hello_world", files);
    }

    /**
     * Python with loops
     */
    public static TestScenario pythonLoops() {
        JsonArray files = new JsonArray();
        files.add(createFile(
                "main.py",
                "main.py",
                "for i in range(10):\n    print(f'Iteration {i}')\n",
                true));
        return new TestScenario("python", "python_loops", files);
    }

    /**
     * JavaScript console.log scenario
     */
    public static TestScenario javascriptHelloWorld() {
        JsonArray files = new JsonArray();
        files.add(createFile(
                "main.js",
                "main.js",
                "console.log('Hello from JavaScript!');\nconsole.log('Load test execution');\n",
                true));
        return new TestScenario("javascript", "js_hello_world", files);
    }

    /**
     * JavaScript with loops
     */
    public static TestScenario javascriptLoops() {
        JsonArray files = new JsonArray();
        files.add(createFile(
                "main.js",
                "main.js",
                "for (let i = 0; i < 10; i++) {\n    console.log(`Iteration ${i}`);\n}\n",
                true));
        return new TestScenario("javascript", "js_loops", files);
    }

    /**
     * Java simple program
     */
    public static TestScenario javaHelloWorld() {
        JsonArray files = new JsonArray();
        files.add(createFile(
                "Main.java",
                "Main.java",
                "public class Main {\n" +
                        "    public static void main(String[] args) {\n" +
                        "        System.out.println(\"Hello from Java!\");\n" +
                        "        System.out.println(\"Load test execution\");\n" +
                        "    }\n" +
                        "}\n",
                true));
        return new TestScenario("java", "java_hello_world", files);
    }

    /**
     * Java with ArrayList
     */
    public static TestScenario javaArrayList() {
        JsonArray files = new JsonArray();
        files.add(createFile(
                "Main.java",
                "Main.java",
                "import java.util.ArrayList;\n" +
                        "public class Main {\n" +
                        "    public static void main(String[] args) {\n" +
                        "        ArrayList<Integer> numbers = new ArrayList<>();\n" +
                        "        for (int i = 0; i < 10; i++) {\n" +
                        "            numbers.add(i);\n" +
                        "        }\n" +
                        "        System.out.println(\"ArrayList size: \" + numbers.size());\n" +
                        "    }\n" +
                        "}\n",
                true));
        return new TestScenario("java", "java_arraylist", files);
    }

    /**
     * Get all available scenarios
     */
    public static List<TestScenario> getAllScenarios() {
        List<TestScenario> scenarios = new ArrayList<>();
        scenarios.add(pythonHelloWorld());
        scenarios.add(pythonLoops());
        scenarios.add(javascriptHelloWorld());
        scenarios.add(javascriptLoops());
        scenarios.add(javaHelloWorld());
        scenarios.add(javaArrayList());
        return scenarios;
    }

    /**
     * Get a random scenario with weighted distribution
     * Python: 40%, JavaScript: 40%, Java: 20%
     */
    public static TestScenario getRandomWeighted() {
        int rand = random.nextInt(100);

        if (rand < 40) {
            // Python (40%)
            return random.nextBoolean() ? pythonHelloWorld() : pythonLoops();
        } else if (rand < 80) {
            // JavaScript (40%)
            return random.nextBoolean() ? javascriptHelloWorld() : javascriptLoops();
        } else {
            // Java (20%)
            return random.nextBoolean() ? javaHelloWorld() : javaArrayList();
        }
    }

    @Override
    public String toString() {
        return "TestScenario{" +
                "language='" + language + '\'' +
                ", name='" + name + '\'' +
                '}';
    }
}
