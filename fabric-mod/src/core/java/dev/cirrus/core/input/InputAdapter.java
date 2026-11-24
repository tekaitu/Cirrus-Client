package dev.cirrus.core.input;

/** Convenience base so a listener only overrides the events it cares about. */
public abstract class InputAdapter implements InputListener {
    @Override public void onKeyPressed(int key, int modifiers) { }
    @Override public void onKeyReleased(int key, int modifiers) { }
    @Override public void onMouseMoved(double x, double y, double dx, double dy) { }
    @Override public void onMousePressed(int button, double x, double y, int modifiers) { }
    @Override public void onMouseReleased(int button, double x, double y, int modifiers) { }
    @Override public void onMouseScrolled(double x, double y, double scrollX, double scrollY) { }
}
