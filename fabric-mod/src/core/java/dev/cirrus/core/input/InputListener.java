package dev.cirrus.core.input;

/** Receives input events as the adapter reports them. All methods have empty defaults in {@link InputAdapter}. */
public interface InputListener {
    void onKeyPressed(int key, int modifiers);

    void onKeyReleased(int key, int modifiers);

    void onMouseMoved(double x, double y, double dx, double dy);

    void onMousePressed(int button, double x, double y, int modifiers);

    void onMouseReleased(int button, double x, double y, int modifiers);

    void onMouseScrolled(double x, double y, double scrollX, double scrollY);
}
