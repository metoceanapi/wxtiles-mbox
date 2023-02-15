// basic vertex shader
        "attribute vec4 a_position; \n"
        "attribute vec4 a_color; \n"
        "varying vec4 v_color; \n"
        "void main() \n"
        "{ \n"
        "	gl_Position = a_position; \n"
        "	v_color = a_color; \n"
        "} \n";

    // basic fragment shader
    const char* fragmentShaderSource =
        "precision mediump float; \n"
        "varying vec4 v_color; \n"
        "void main() \n"
        "{ \n"
        "	gl_FragColor = v_color; \n"
        "} \n";

    // create shader program
    GLuint program = glCreateProgram();

    // create vertex shader
    GLuint vertexShader = glCreateShader(GL_VERTEX_SHADER);
    glShaderSource(vertexShader, 1, &vertexShaderSource, NULL);
    glCompileShader(vertexShader);

    // create fragment shader
    GLuint fragmentShader = glCreateShader(GL_FRAGMENT_SHADER);
    glShaderSource(fragmentShader, 1, &fragmentShaderSource, NULL);
    glCompileShader(fragmentShader);

    // attach shaders to program
    glAttachShader(program, vertexShader);
    glAttachShader(program, fragmentShader);

    // link program
    glLinkProgram(program);

    // use program
    glUseProgram(program);

    // create vertex buffer
    GLuint vbo;
    glGenBuffers(1, &vbo);

    // bind vertex buffer
    glBindBuffer(GL_ARRAY_BUFFER, vbo);

    // create vertex data
    GLfloat vertices[] = {
        // x, y, z, r, g, b
        -0.5f, -0.5f, 0.0f, 1.0f, 0.0f, 0.0f,
        0.5f, -0.5f, 0.0f, 0.0f, 1.0f, 0.0f,
        0.0f, 0.5f, 0.0f, 0.0f, 0.0f, 1.0f
    };

    // fill vertex buffer
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

    // enable vertex attributes
    glEnableVertexAttribArray(0);
    glEnableVertexAttribArray(1);   