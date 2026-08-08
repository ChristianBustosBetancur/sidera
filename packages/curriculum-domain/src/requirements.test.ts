import { describe, expect, it } from "vitest";
import type { VersionCourseId } from "./identifiers.js";
import { courseCompleted } from "./requirements.js";

describe("requirement helpers", () => {
  it("constructs a single course prerequisite", () => {
    const versionCourseId = "version-course-a" as VersionCourseId;

    expect(courseCompleted(versionCourseId)).toEqual({
      type: "COURSE_COMPLETED",
      versionCourseId,
    });
  });
});
